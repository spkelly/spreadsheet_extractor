const { DIFAT_START, END_SECTOR, FAT_SECTOR, FREE_SECTOR } = require("./shared/constants");
const { u_getByteOffset, u_leftPad } = require("./shared/untilites");
const SectorIdChain = require("./SectorIdChain");

const fs = require("fs");

// Sectors are 512 bytes in major version 3
const SECTOR_SIZE = 512;

Number.prototype.toHex = function(){return this.toString(16)}
Number.prototype.toBin = function(){return this.toString(2)}




function buildSectorIdChains(allocationTable, tableLength){
  let streams = [];
  let endOfChain = false;
  currentRecord = 0;
  for(let offset = 0; offset < tableLength; offset +=4){    
    let currentStream = new SectorIdChain();

    while (!endOfChain && offset < tableLength){
      let currentEntry = allocationTable.getInt16(offset, true);
      if(currentEntry == FREE_SECTOR || currentEntry == FAT_SECTOR){
        offset += 4;
        currentRecord ++;
        continue;
      }
      if(!currentStream.startSector){
        currentStream.setStartSector(currentRecord);
        currentStream.setByteOffset( u_getByteOffset(currentRecord + 1));
      } 
      currentStream.addItem(currentEntry);
      if(currentEntry == END_SECTOR) break;
      offset += 4;
      currentRecord ++;
    }
      if(currentStream.getLength() > 0){
        streams.push(currentStream);
        endOfChain = false;
      }
    
    currentRecord ++;
  }

  return streams;


}
  


class cfbDirectory{
  constructor(directryRef, data){
    this.data;
  }


}




class DirectoryReference{
  constructor(directoryData){
    this.name = '';
    this.size = 0;
    this.startSector;
    this.usesMiniFat = false;
    this._init(directoryData);
    this.sectorIdChan;
  }

  _init(data){
    let dv = new DataView(data.buffer);
    this.name = this._decodeDirName(data.slice(0,64));
    this.startingSector = dv.getUint32(0x74,true);
    this.size = dv.getUint16(0x78, true);
    this.usesMiniFat = this.size < 4096;
  }

  _decodeDirName(data){
    let dv = new DataView(data.buffer);
    let result = '';
    let byteOffset = 0;
    let currentByte = dv.getUint16(byteOffset,true);
    while (currentByte != 0){
      result += String.fromCharCode(currentByte);
      byteOffset += 2;
      currentByte = dv.getUint16(byteOffset, true);
    } 
  
    return result;
  };

  toString(){
    return `Directory Name: ${this.name} StartSector: ${this.startSector} Size: ${this.size} bytes`
  }
}


function convertSectorCountToOffset(sectorCount, sectorSize){
  return offset = '0x' + (sectorSize + (sectorCount * sectorSize)).toHex().toUpperCase();
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



  let difatInUse = fileInfo.NumberOfFatSectors > 1;

  let sectorIdStreams = [];

  if(difatInUse){
    let FATstream = makeFATSectorChain(fileInfo.fatStartingLocation, headerDV);
    // console.log(FATstream);
    let FAT = buildDataFromStream(FATstream,data);
    // console.log(FAT.buffer);
    let length = FATstream.length * 512;
    sectorIdStreams = buildSectorIdChains(new DataView(FAT.buffer), length);

  }
  else{
      sectorIdStreams = buildSectorIdChains(new DataView(fat.buffer), FATLength);
  


    }


  
  let directoryStream = findStream( sectorIdStreams, fileInfo.directoryStartinglocation);
  let miniFatStream = findStream(sectorIdStreams, fileInfo.miniFatStartingLocation);
  
  // console.log(sectorIdStreams);
  console.log('Found directory stream: ', JSON.stringify(directoryStream));
  if(miniFatStream){
    console.log('Found Mini-Fat stream:  ', JSON.stringify(miniFatStream));
  }
  let directoryStructure = parseDirectorySectors(directoryStream, data);

  console.log(directoryStructure);

}


function splitData(data, chunkSize, offset=0){
  let chunks = [];
  for(let i = offset; i < data.length; i+= chunkSize){
    let theData = data.slice(i, i+ chunkSize);
    if (theData[0] == 0) continue;
    chunks.push(theData)
  }

  return chunks;
}

function parseDirectorySectors(directoryStream, data){
  let directoryEntries = splitData(directoryStream.buildStream(data), 128, 128);
  return  directoryEntries.map(dirData => new DirectoryReference(dirData));
}

function buildDataFromSectorIdStream(fatStream, buffer){
  streamSize = fatStream.getByteSize();
  let data = new Uint8Array(streamSize);
  let fileOffset = u_getByteOffset(fatStream.startingSector + 1) ;
  let dataOffset = 0;
  for(let chainEntry = 0; chainEntry < fatStream.getLength(); chainEntry ++){
    let d = buffer.slice(fileOffset, fileOffset + 512);
    data.set(d, dataOffset);
    if(fatStream.chain[chainEntry] == END_SECTOR) break;
    fileOffset = u_getByteOffset(fatStream.chain[chainEntry] + 1);
    console.log(fileOffset.toHex())
    dataOffset += SECTOR_SIZE;
  }

  return data;
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
  let streamLocation = streams.find(element=>element.startSector == startingLocation)
  if(streamLocation == -1) throw new Error('Could not find directory stream');
  return streamLocation;  
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