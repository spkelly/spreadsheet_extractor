const { count } = require("console");
const fs = require("fs");

const DIFAT_START= 0x50;
const DIFAT_SECTOR_ENTRIES = 109;
const END_SECTOR = -2;
const FAT_SECTOR = -3;
const FREE_SECTOR = -1;

// Sectors are 512 bytes in major version 3
const SECTOR_SIZE = 512;

Number.prototype.toHex = function(){return this.toString(16)}
Number.prototype.toBin = function(){return this.toString(2)}

let u_getByteOffset = sectorNumber => sectorNumber * SECTOR_SIZE;
let u_getSectorEnd = begin => begin + SECTOR_SIZE
let u_leftPad = (count=80, char=' ') => char.repeat(count);
let u_prettyPrintHex = num => '0x' + num.toHex();

  


function convertSectorCountToOffset(sectorCount, sectorSize){
  let offset = '0x' + (sectorSize + (sectorCount * sectorSize)).toHex().toUpperCase();
  return offset;
}


function formatOutput(prefix,suffix, min=40){
  let pad = '';
  let len = prefix.length + suffix.length;
  let count = min - len;
  if(count > 0) pad = u_leftPad(count, '');
  

  return prefix + pad + suffix;
}

function readFile(){


  let args = process.argv.slice(2);

  let fileName = args[0] || 'test.xls';

  
  // console.log(fileName);
  let data;

  try{
    data = fs.readFileSync(fileName, null);
  }
  catch(e){
    if(e.code == 'ENOENT'){
      console.log('File not Found, make sure file is in the test directory');
      return;
    }
    else{
      console.log('someting bad happended');
      console.log(e);
      return;
    }
  }



  const dataView = new Uint8Array(data);
  let headerDV = new DataView(dataView.slice(0,512).buffer);
  let fileInfo = parseHeaderInfo(headerDV);
  fileInfo.sectorSize = fileInfo.majorVersion == 3? 512 : 4096;
  console.table(fileInfo);
  console.log(formatOutput('FAT starting offset: ',convertSectorCountToOffset(fileInfo.fatStartingLocation,512)));
  console.log(formatOutput('Mini FAT starting offset: ',convertSectorCountToOffset(fileInfo.miniFatStartingLocation,512)));
  console.log(formatOutput('Directory starting offset: ',convertSectorCountToOffset(fileInfo.directoryStartinglocation,512)));
  console.log(`\n${'='.repeat(80)}\n`);

  // Parse FAT
  let FATLength = fileInfo.sectorSize * fileInfo.NumberOfFatSectors;
  let FAToffset = (512 + (fileInfo.fatStartingLocation * 512));
  let fat = dataView.slice(FAToffset, FAToffset + FATLength);

  // let fat= new Float32Array(fileInfo.NumberOfFatSectors * 512);

  



  

  // }

  let difatInUse = fileInfo.NumberOfFatSectors > 1;

  let sectorIdStreams = [];

  if(difatInUse){
    let FATstream = makeFATSectorChain(fileInfo.fatStartingLocation, headerDV);
    // console.log(FATstream);
    let FAT = buildDataFromStream(FATstream,data);
    // console.log(FAT.buffer);
    let length = FATstream.length * 512;
    sectorIdStreams = buildSectorIdStreams(new DataView(FAT.buffer), length);

  }
  else{
      sectorIdStreams = buildSectorIdStreams(new DataView(fat.buffer), FATLength);
  


    }


  
  let directoryStream = findStream( sectorIdStreams, fileInfo.directoryStartinglocation);
  let miniFatStream = findStream(sectorIdStreams, fileInfo.miniFatStartingLocation);
  
  // console.log(sectorIdStreams);
  console.log('Found directory stream: ', JSON.stringify(directoryStream));
  if(miniFatStream){
    console.log('Found Mini-Fat stream:  ', JSON.stringify(miniFatStream));
  }
  let directoryStructure = parseDirectorySectors(directoryStream.stream, data)
  


  console.log(directoryStructure);


}

function makeDirectoryEntries(data){
  console.log("the data", data);
  let dirEntrySize = 128;
  let entries = [];
  for(let i = 0; i < data.length; i+= dirEntrySize){
    let theData = data.slice(i, i+ dirEntrySize)


    entries.push(theData)
  }
  return entries;
}

function parseDirectorySectors(directoryStream, data){
  let directorySectors = buildDataFromStream(directoryStream, data);
  // let directoryEntries = makeDirectoryEntries(directorySectors);

  let test = makeDirectoryEntries(directorySectors);

  // test.forEach((dirEntry)=>console.log("\n\n" , dirEntry));

}


function buildDataFromStream(){

}

function buildDataFromStream(sectorStream, data){
  console.log('the sector stream length! ', sectorStream.length);
  streamSize = sectorStream.length * SECTOR_SIZE;

  let FAT = new Uint8Array(streamSize);
  fatOffset = 0;

  for(let chainEntry = 0; chainEntry < sectorStream.length; chainEntry ++){
    let byteOffset = u_getByteOffset(sectorStream[chainEntry]);
    let endOffset = byteOffset + SECTOR_SIZE;
    FAT.set(data.slice(byteOffset, endOffset),fatOffset)
    fatOffset += SECTOR_SIZE;
  }
  // let fat= new Float32Array(fileInfo.NumberOfFatSectors * 512);
  // fat.set(data.slice(512,1024))

  // console.log(fat);

  return FAT;
}

function makeFATSectorChain(startSector,data){
  let chain = [startSector + 1];
  let offset = DIFAT_START;
  let currentEntry; 
  let endOfStream = false;
  while(!endOfStream){
    currentEntry = data.getInt16(offset, true);

    if(currentEntry == FREE_SECTOR || currentEntry == END_SECTOR || offset >= 512){
      break; 
    }
    chain.push(currentEntry + 1);
    offset += 4;
  }
  return chain;
}



function findStream(streams, startingLocation){
  let streamLocation = streams.find(element=>element.startingSector == startingLocation)
  if(streamLocation == -1) throw new Error('Could not find directory stream');
  return streamLocation;  
}

function findMiniStream(){

}


function buildSectorIdStreams(FAT, FATLength){
  let streams = [];
  let endOfStream = false;
  let endOfFat = false;
  currentRecord = 0;
  for(let offset = 0; offset < FATLength; offset +=4){
    
    let currentStream = {stream:[]};
    while (!endOfStream && offset < FATLength){
      let currentEntry = FAT.getInt16(offset, true);
      if(currentEntry == FREE_SECTOR || currentEntry == FAT_SECTOR){
        offset += 4;
        currentRecord ++;
        continue;
      }
      if(!currentStream.startingSector){
        currentStream.startingSector = currentRecord;
        currentStream.byteOffset = u_getByteOffset(currentRecord + 1);
      } 
      currentStream.stream.push(currentEntry);
      if(currentEntry == END_SECTOR) break;
      offset += 4;
      currentRecord ++;
    }
      if(currentStream.stream.length > 0){
        currentStream.byteLength = currentStream.stream.length * 512;
        streams.push(currentStream);
        endOfStream = false;
      }
    
    currentRecord ++;
  }

  return streams;


}


function getFileSectors(file, sectorSize){
  let sectorCount = file.length / sectorSize;
  let fileSectors = [];
  for(let i = 0; i < file.length; i+=sectorSize){
    fileSectors.push(new DataView(file.buffer.slice(i,i+sectorSize)));
  }
  return fileSectors;
}



function parseHeaderInfo(header){

  let fileSig = header.getUint32(0, true);
  let SectorSize = header.getUint8(0x1E, true);
  let MinStreamSize = header.getUint8(0x20,true);
  let NumberOfFatSectors = header.getUint32(0x2C, true);
  let majorVersion = header.getUint8(0x1A, true);
  let directoryStartinglocation = header.getUint32(0x30, true);
  let miniFatStartingLocation = header.getInt32(0x3c, true);
  let fatStartingLocation = header.getUint32(0x4c,true);
  return {
    fileSig: fileSig.toHex(), 
    majorVersion,
    MinStreamSize: 4096,
    NumberOfFatSectors, 
    directoryStartinglocation,
    fatStartingLocation,
    miniFatStartingLocation
  }
}

console.time("app")
readFile();
console.timeEnd("app");