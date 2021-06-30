const { END_SECTOR } = require("./shared/constants");
const { u_getByteOffset } = require("./shared/untilites");

class SectorIdChain {
  constructor(sectorSize = 512){
    this.startSector;
    this.byteOffset;
    this.chain = [];
    this.sectorSize = sectorSize
  }



  addItem(item){
    this.chain.push(item);
  }

  getLength() {
    return this.chain.length;
  }

  getByteSize(){
    return this.chain.length * this.sectorSize;
  }

  setStartSector(sector){
    this.startSector = sector;
  }

  setByteOffset(offset){
    this.byteOffset = offset
  }


  buildStream(data, sectorSize=512){
    let result = new Uint8Array(this.getByteSize());
    let fileOffset = u_getByteOffset(this.startSector + sectorSize);
    let dataOffset = 0;
    for(let chainEntry = 0; chainEntry < this.getLength(); chainEntry ++){
      result.set(data.slice(fileOffset, fileOffset + sectorSize), dataOffset);
      if(this.chain[chainEntry] == END_SECTOR) break;
      fileOffset = u_getByteOffset(this.chain[chainEntry] + 1);
      dataOffset += sectorSize;
    }
    return result;
  }
}

module.exports = SectorIdChain;