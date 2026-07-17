import {ImapFlow} from 'imapflow';

const GMAIL_API='https://gmail.googleapis.com/gmail/v1/users/me';
const GOOGLE_TOKEN_URL='https://oauth2.googleapis.com/token';

const cleanHeader=value=>String(value||'').replace(/[\r\n]+/g,' ').trim();
const base64Url=buffer=>Buffer.from(buffer).toString('base64url');
const fromBase64Url=value=>Buffer.from(String(value||''),'base64url');

export function passwordCandidates(value){
  const raw=String(value||'').trim(),compact=raw.replace(/[\s-]+/g,'');
  return [...new Set([raw,compact].filter(Boolean))];
}

export function authFailureLabel(error){
  const kind=error?.authenticationFailed?'auth':error?.constructor?.name||'error';
  const code=error?.serverResponseCode||error?.responseStatus||error?.code||'unknown';
  return `${kind}:${String(code).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,48)}`;
}

function chooseMailbox(list,special,fallback){
  return list.find(x=>x.specialUse===special)?.path||list.find(x=>fallback.test(x.path))?.path||'';
}

function addressOf(list=[]){return list?.[0]?.address||'';}

function firstAddress(value){
  const src=cleanHeader(value),angle=src.match(/<([^<>\s]+@[^<>\s]+)>/);
  return (angle?.[1]||src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'').toLowerCase();
}

function gmailHeader(message,name){
  return message?.payload?.headers?.find(x=>String(x.name||'').toLowerCase()===name.toLowerCase())?.value||'';
}

export function normalizeGmailMessage(message,id=message?.id){
  return {
    id,
    messageId:cleanHeader(gmailHeader(message,'Message-ID')),
    subject:cleanHeader(gmailHeader(message,'Subject')),
    from:firstAddress(gmailHeader(message,'From')),
    to:firstAddress(gmailHeader(message,'To')),
    internalDate:new Date(Number(message?.internalDate)||Date.now())
  };
}

class IcloudMailbox{
  constructor(client,email,paths){this.client=client;this.email=email;this.provider='icloud';this.paths=paths;}
  async list(kind,sinceDays=45){
    const path=this.paths[kind];if(!path)return [];
    const lock=await this.client.getMailboxLock(path,{readOnly:true});
    try{
      const ids=await this.client.search({since:new Date(Date.now()-sinceDays*86400000)},{uid:true});
      const chosen=ids.slice(-120),out=[];if(!chosen.length)return out;
      for await(const m of this.client.fetch(chosen.join(','),{uid:true,envelope:true,internalDate:true},{uid:true})){
        out.push({id:m.uid,messageId:cleanHeader(m.envelope?.messageId),subject:m.envelope?.subject||'',from:addressOf(m.envelope?.from),to:addressOf(m.envelope?.to),internalDate:m.internalDate||new Date()});
      }
      return out;
    }finally{lock.release();}
  }
  async source(kind,id){
    const path=this.paths[kind];if(!path)return Buffer.alloc(0);
    const lock=await this.client.getMailboxLock(path,{readOnly:true});
    try{return (await this.client.fetchOne(id,{source:true},{uid:true}))?.source||Buffer.alloc(0);}
    finally{lock.release();}
  }
  async appendDraft(raw){
    if(!this.paths.drafts)throw new Error('iCloud-Entwurfsordner nicht gefunden');
    await this.client.append(this.paths.drafts,raw,['\\Draft']);
  }
  async close(){await this.client.logout().catch(()=>{});}
}

async function connectIcloud(env){
  const email=String(env.ICLOUD_EMAIL||'').trim();
  if(!email||!env.ICLOUD_APP_PASSWORD)throw new Error('iCloud-Konfiguration unvollständig');
  const users=[email.split('@')[0],email].filter((x,i,a)=>x&&a.indexOf(x)===i),passwords=passwordCandidates(env.ICLOUD_APP_PASSWORD),failures=new Set();
  for(const user of users){for(const password of passwords){
    const client=new ImapFlow({host:'imap.mail.me.com',port:993,secure:true,auth:{user,password},logger:false,disableAutoIdle:true});
    try{
      await client.connect();
      const boxes=await client.list();
      const paths={inbox:chooseMailbox(boxes,'\\Inbox',/^inbox$/i)||'INBOX',sent:chooseMailbox(boxes,'\\Sent',/sent|gesendet/i),drafts:chooseMailbox(boxes,'\\Drafts',/draft|entwurf/i)};
      return new IcloudMailbox(client,email,paths);
    }catch(error){failures.add(authFailureLabel(error));await client.logout().catch(()=>{});}
  }}
  throw new Error(`iCloud-Anmeldung fehlgeschlagen (${[...failures].join(', ')||'unknown'}); App-Passwort oder Adresse prüfen`);
}

class GmailMailbox{
  constructor(token,email){this.token=token;this.email=email;this.provider='gmail';}
  async request(path,options={}){
    const response=await fetch(`${GMAIL_API}${path}`,{...options,headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json',...(options.headers||{})}});
    if(!response.ok)throw new Error(`Gmail API ${response.status}`);
    return response.status===204?null:response.json();
  }
  async messageMetadata(id){return this.request(`/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Message-ID`);}
  async draftMetadata(id){return this.request(`/drafts/${encodeURIComponent(id)}?format=metadata`);}
  async list(kind,sinceDays=45){
    if(kind==='drafts'){
      const listing=await this.request('/drafts?maxResults=120'),out=[];
      for(const item of listing?.drafts||[]){const draft=await this.draftMetadata(item.id);out.push(normalizeGmailMessage(draft.message,item.id));}
      return out;
    }
    const label=kind==='sent'?'sent':'inbox',query=encodeURIComponent(`in:${label} newer_than:${sinceDays}d`),listing=await this.request(`/messages?maxResults=120&q=${query}`),out=[];
    for(const item of listing?.messages||[]){out.push(normalizeGmailMessage(await this.messageMetadata(item.id)));}
    return out;
  }
  async source(kind,id){
    if(kind!=='inbox')return Buffer.alloc(0);
    const message=await this.request(`/messages/${encodeURIComponent(id)}?format=raw`);
    return fromBase64Url(message.raw);
  }
  async appendDraft(raw){await this.request('/drafts',{method:'POST',body:JSON.stringify({message:{raw:base64Url(raw)}})});}
  async close(){}
}

async function gmailAccessToken(env){
  const required=['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN'];
  if(required.some(key=>!env[key]))throw new Error('Gmail-OAuth-Konfiguration unvollständig');
  const body=new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'});
  const response=await fetch(GOOGLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok)throw new Error(`Gmail-OAuth fehlgeschlagen (${response.status})`);
  const result=await response.json();if(!result.access_token)throw new Error('Gmail-OAuth lieferte kein Zugriffstoken');
  return result.access_token;
}

async function connectGmail(env){
  const expected=String(env.GMAIL_EMAIL||'').trim().toLowerCase();if(!expected)throw new Error('GMAIL_EMAIL fehlt');
  const mailbox=new GmailMailbox(await gmailAccessToken(env),expected),profile=await mailbox.request('/profile');
  if(String(profile?.emailAddress||'').toLowerCase()!==expected)throw new Error('Gmail-Konto stimmt nicht mit GMAIL_EMAIL überein');
  return mailbox;
}

export function mailProviderName(env=process.env){
  const value=String(env.MAIL_PROVIDER||'icloud').trim().toLowerCase();
  if(!['icloud','gmail'].includes(value))throw new Error('MAIL_PROVIDER muss icloud oder gmail sein');
  return value;
}

export async function connectMailbox(env=process.env){return mailProviderName(env)==='gmail'?connectGmail(env):connectIcloud(env);}

