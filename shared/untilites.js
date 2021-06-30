
const utility_functions= {
  u_getByteOffset :   (sectorNumber, sectorSize=512) => sectorNumber * sectorSize,
  u_getSectorEnd :    begin => begin + SECTOR_SIZE,
  u_leftPad :         (count=80, char=' ') => char.repeat(count),
  u_prettyPrintHex :  num => '0x' + num.toHex()
}


module.exports = utility_functions;