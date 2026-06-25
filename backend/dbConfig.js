import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);
mongoose.set('autoIndex', false); 

console.log('🛡️ [Database Config]: تم تأمين محرك Mongoose وتعطيل البفرنج والتفهرس التلقائي بنجاح.');
