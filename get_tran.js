const { ethers } = require('ethers')

async function main() {

  const provider = new ethers.providers.JsonRpcProvider("https://eth-goerli.g.alchemy.com/v2/FymkT5AN_7jP73FiN25D_fDf3AIMy0zX")

  let res = await provider.getTransactionReceipt('0xa20adbfe169dab3357dd9d4475ceaa6053e60dde4bbf95d069ab373a3224c880');
  res.logs
  console.log(res);

  for (var i=0; i<res.logs.length; i++)
  {
    if (res.logs[i].topics[0] == '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f')
    { 
      console.log("got it: i:"+i);
      for (var j=1; j<res.logs[i].topics.length; j++)
      {
        console.log("j:"+j+" "+res.logs[i].topics[j]);
      }
    }
  }
}

main()