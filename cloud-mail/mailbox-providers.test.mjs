import assert from 'node:assert/strict';
import {connectMailbox,mailProviderName,normalizeGmailMessage,passwordCandidates} from './mailbox-providers.mjs';

assert.deepEqual(passwordCandidates('abcd-efgh-ijkl-mnop'),['abcd-efgh-ijkl-mnop','abcdefghijklmnop']);
assert.equal(mailProviderName({}),'icloud');
assert.equal(mailProviderName({MAIL_PROVIDER:'GMAIL'}),'gmail');
assert.throws(()=>mailProviderName({MAIL_PROVIDER:'other'}),/icloud oder gmail/);

const normalized=normalizeGmailMessage({
  id:'m1',internalDate:'1784296800000',payload:{headers:[
    {name:'From',value:'Camping Test <Info@Test.Example>'},
    {name:'To',value:'Roadtrip <trip@example.com>'},
    {name:'Subject',value:'Re: Pitch availability'},
    {name:'Message-ID',value:'<reply@test.example>'}
  ]}
});
assert.equal(normalized.from,'info@test.example');
assert.equal(normalized.to,'trip@example.com');
assert.equal(normalized.messageId,'<reply@test.example>');

const originalFetch=globalThis.fetch,calls=[];
globalThis.fetch=async (url,options={})=>{
  calls.push({url:String(url),method:options.method||'GET',headers:options.headers,body:options.body});
  if(String(url)==='https://oauth2.googleapis.com/token')return {ok:true,status:200,json:async()=>({access_token:'token-1'})};
  if(String(url).endsWith('/profile'))return {ok:true,status:200,json:async()=>({emailAddress:'trip@example.com'})};
  if(String(url).includes('/messages?'))return {ok:true,status:200,json:async()=>({messages:[{id:'m1'}]})};
  if(String(url).includes('/messages/m1?format=metadata'))return {ok:true,status:200,json:async()=>({id:'m1',internalDate:'1784296800000',payload:{headers:[{name:'From',value:'info@test.example'},{name:'To',value:'trip@example.com'},{name:'Subject',value:'Test'},{name:'Message-ID',value:'<m1@test>'}]}})};
  if(String(url).includes('/messages/m1?format=raw'))return {ok:true,status:200,json:async()=>({raw:Buffer.from('Subject: Test\r\n\r\nHello').toString('base64url')})};
  if(String(url).endsWith('/drafts?maxResults=120'))return {ok:true,status:200,json:async()=>({drafts:[]})};
  if(String(url).endsWith('/drafts')&&options.method==='POST')return {ok:true,status:200,json:async()=>({id:'d1'})};
  throw new Error(`Unerwarteter Test-Aufruf: ${url}`);
};

try{
  const mailbox=await connectMailbox({MAIL_PROVIDER:'gmail',GMAIL_EMAIL:'trip@example.com',GMAIL_CLIENT_ID:'client',GMAIL_CLIENT_SECRET:'secret',GMAIL_REFRESH_TOKEN:'refresh'});
  assert.equal(mailbox.provider,'gmail');
  assert.equal(mailbox.email,'trip@example.com');
  assert.equal((await mailbox.list('inbox'))[0].messageId,'<m1@test>');
  assert.ok((await mailbox.source('inbox','m1')).toString().includes('Hello'));
  assert.deepEqual(await mailbox.list('drafts'),[]);
  await mailbox.appendDraft(Buffer.from('From: trip@example.com\r\n\r\nKind regards,\r\n\r\n'));
  assert.ok(calls.every(call=>!call.url.includes('/send')),'Provider darf niemals den Gmail-Sende-Endpunkt aufrufen');
  assert.ok(calls.filter(call=>call.url.includes('gmail.googleapis.com')).every(call=>call.headers.Authorization==='Bearer token-1'));
}finally{globalThis.fetch=originalFetch;}

console.log(JSON.stringify({ok:true,oauthRefresh:true,accountBinding:true,readOnlyFetch:true,draftCreateOnly:true,noSendEndpoint:true}));
