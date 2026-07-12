#!/usr/bin/env node
import {classifyReply} from './camping-mail-core.mjs';

const encoded=process.argv[2]||'';
if(!encoded){console.error('Usage: camping-mail-classify.mjs <base64url>');process.exit(2);}
try{console.log(JSON.stringify(classifyReply(Buffer.from(encoded,'base64url').toString('utf8'))));}
catch(error){console.error(JSON.stringify({ok:false,error:String(error.message||error)}));process.exit(1);}
