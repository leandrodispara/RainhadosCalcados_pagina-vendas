import {readFile,writeFile,rename} from 'node:fs/promises';

const [drivePath,configPath,sourceFolderId,targetFolderId]=process.argv.slice(2);

const validFolderId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(value);
if(!drivePath||!configPath||!validFolderId(sourceFolderId)||!validFolderId(targetFolderId))throw Error('Parâmetros da migração do Drive inválidos.');

const folderLine=/export\s+const\s+FOLDER_ID\s*=\s*(['"])([^'"\r\n]+)\1\s*;/;
const driveSource=await readFile(drivePath,'utf8');
const match=driveSource.match(folderLine);
if(!match)throw Error('Não foi possível localizar a pasta configurada no Drive.');
const currentFolderId=match[2];
if(currentFolderId!==sourceFolderId&&currentFolderId!==targetFolderId)throw Error('A pasta atualmente configurada não é a esperada. Nenhuma alteração foi feita.');

let config;
try{config=JSON.parse(await readFile(configPath,'utf8'));}catch{throw Error('Não foi possível ler a configuração do Google Drive.');}
if(!config||typeof config!=='object'||Array.isArray(config))throw Error('A configuração do Google Drive é inválida.');
if(config.folderId&&config.folderId!==sourceFolderId&&config.folderId!==targetFolderId)throw Error('A pasta da configuração do Google Drive não é a esperada. Nenhuma alteração foi feita.');

if(currentFolderId===targetFolderId&&config.folderId===targetFolderId){
 console.log('DRIVE_SWITCHED=0');
 process.exit(0);
}

const nextDrive=driveSource.replace(folderLine,"export const FOLDER_ID='"+targetFolderId+"';");
const nextConfig={...config,folderId:targetFolderId};
const driveTemp=drivePath+'.rainha-drive.tmp';
const configTemp=configPath+'.rainha-drive.tmp';

await writeFile(driveTemp,nextDrive,{encoding:'utf8',mode:0o644});
await writeFile(configTemp,JSON.stringify(nextConfig,null,2)+'\n',{encoding:'utf8',mode:0o600});
await rename(configTemp,configPath);
await rename(driveTemp,drivePath);
console.log('DRIVE_SWITCHED=1');
