const { ethers } = require('ethers')
const { Token } = require('@uniswap/sdk-core')
const { TickMath, FullMath, Pool, Position, nearestUsableTick } = require('@uniswap/v3-sdk')
const { abi: IUniswapV3PoolABI }  = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const { abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json')
const { abi: UniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
const JSBI = require('jsbi');
//const ERC20ABI = require('./abi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.PROVIDE_URL
const WALLET_ADDRESS = process.env.WALLET_ADDR
const WALLET_SECRET = process.env.WALLET_SECRET
const chainId = 42161

// 这个合约地址可以从 factoryContract.getPool
//const poolAddress = "0x07A4f63f643fE39261140DF5E613b9469eccEC86" // UNI/WETH
// 0x3D807E94BF75ddEfbed21C9f3DeC1ab80c26F28D  // ZETA/WETH
const poolAddress = "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443";  // 需要修改
const positionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" // NonfungiblePositionManager
const factoryAddress = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET)

const name0 = 'Wrapped Ether'
const symbol0 = 'WETH'
const decimals0 = 18
const address0 = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'

const name1 = 'USD Coin'
const symbol1 = 'USDC'
const decimals1 = 6
const address1 = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'

const WethToken = new Token(chainId, address0, decimals0, symbol0, name0)
const UniToken = new Token(chainId, address1, decimals1, symbol1, name1)

const nonfungiblePositionManagerContract = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  provider
)
const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
)

const factoryContract = new ethers.Contract(
  factoryAddress,
  UniswapV3Factory,
  provider
)

async function getPoolData(poolContract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ])

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  }
}

var lpPoolList;
function lpPoolPush(lpPrice, lpUpper, lpLower, lpTokenID)
{
  lpPoolList.push({Price:lpPrice, Upper:lpUpper, Lower:lpLower, TokenID:lpTokenID});
}


//second
function sleep(delay) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay*1000);
  });
}

function getPriceFromTick(tick)
{
  var sqrtRatioX96;
  var ratioX192;
  var shift;
  var baseAmount;
  var quoteAmount;
  
    sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
    ratioX192    = JSBI.multiply(sqrtRatioX96, sqrtRatioX96);
    baseAmount   = JSBI.BigInt(10**decimals0);
    shift        = JSBI.leftShift(JSBI.BigInt(1), JSBI.BigInt(192));
    quoteAmount  = FullMath.mulDivRoundingUp(ratioX192, baseAmount, shift);
    quoteAmount = quoteAmount/(10**decimals1);
    
    return quoteAmount;	
}

// 组LP的价格，如果lp_price 为0, 就代表还没开始组LP
var lp_price = 0;
var lp_eth_amount = 0;
var lp_usdc_amount = 0;
var lp_token_id = 0;


// 用于暂存 比较的lp价格
var cur_lp_price = 0;
var cur_lp_upper = 0;
var cur_lp_lower = 0;

var isNeedMonitorInit = 1;
async function monitor_hdl()
{ 
    var cnt;
    var cur_lp_price_temp = 0;
    var cur_lp_upper_temp = 0;
    var cur_lp_lower_temp = 0;    
    
    var monTickUpper;
    var monTickLower;  
    var poolData;
    
    cnt = 0;
    while (1)
    {
	    // 监控
	    try {
	        poolData = await getPoolData(poolContract)
	    } catch (error) {
	        error.message; // "Oops!"
	      
	        console.log ("oops .............");
	        await sleep(5);
	        continue;
	    }

	    // 方式1：
	    cur_lp_price_temp = getPriceFromTick(poolData.tick);
	    console.log ("1==>tick:"+poolData.tick.toString()+ " price:"+cur_lp_price_temp.toString());

	    // lower
	    //
	    monTickLower = (nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 8);
	    cur_lp_lower_temp = getPriceFromTick(monTickLower);
	    console.log ("lower:"+cur_lp_lower_temp);

	    // upper
	    monTickUpper = (nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 8);
	    cur_lp_upper_temp = getPriceFromTick(monTickUpper);
	    console.log ("upper:"+cur_lp_upper_temp);

	    if (isNeedMonitorInit)
	    {
        cur_lp_price = cur_lp_price_temp;
        cur_lp_upper = cur_lp_upper_temp;
        cur_lp_lower = cur_lp_lower_temp;  	    	
	    	isNeedMonitorInit = 0;
	    }
	    else
	    {
	    	//  当前价格越界
	    	if ((cur_lp_price_temp < cur_lp_lower)
	           || (cur_lp_price_temp > cur_lp_upper))
	        {
	        	console.log("[monitor] recnt=0");
	       	cnt = 0;
	       	// 重新赋值
			cur_lp_price = cur_lp_price_temp;
			cur_lp_upper = cur_lp_upper_temp;
			cur_lp_lower = cur_lp_lower_temp;  	    		       	
	        }
	    }

	    console.log (Date.now()/1000);
	    await sleep(20);	
	    
	    cnt++;
	    // 15*60, 测试就 60
	    if (cnt >= (15*60/20))
	    {
	    	// 可以去组LP监控完成
	    	console.log("[monitor]finish monitor:"+cur_lp_price_temp + " UP:"+ cur_lp_upper_temp + " DOWN:"+cur_lp_lower_temp);
	    	break;
	    }
    }
}

// 组LP
async function make_lp()
{
  var monTickUpper;
  var monTickLower;  

  const poolAddress = await factoryContract.getPool(address1, address0,  500)
  console.log('poolAddress', poolAddress.toString())

  var poolData = await getPoolData(poolContract)
  console.log("fee:"+poolData.fee);

  const WETH_UNI_POOL = new Pool(
    WethToken,
    UniToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  )
  console.log("fee:"+poolData.fee.toString()+" tick:"+poolData.tick.toString()+ " liquidity:"+poolData.liquidity.toString());

  const position = new Position({
    pool: WETH_UNI_POOL,
    liquidity: ethers.utils.parseUnits('0.01', 18),  // 这里的总的ETH价格
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 8,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 8,
  })

  console.log("lower:"+ (nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 8));
  console.log("upper:"+ (nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 8));  

  const wallet = new ethers.Wallet(WALLET_SECRET)
  const connectedWallet = wallet.connect(provider)

  const approvalAmount = ethers.utils.parseUnits('1', 18).toString()

  const { amount0: amount0Desired, amount1: amount1Desired} = position.mintAmounts
  // mintAmountsWithSlippage
  console.log("mount0:"+amount0Desired.toString()+" mount1:"+amount1Desired.toString());

  params = {
    token0: address0,
    token1: address1,
    fee: poolData.fee,
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 8,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 8,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: amount0Desired.toString(),
    amount1Min: amount1Desired.toString(),
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + (60 * 10)
  }

  
  nonfungiblePositionManagerContract.connect(connectedWallet).mint(
    params,                          
    { gasLimit: ethers.utils.hexlify(1000000) }
  ).then(async (res) => {
    console.log("msg out:");
    console.log(res);
    console.log("END");

    const hash = res.hash;
    console.log("hash:"+res.hash);

    var recRes;
    var n;
    for (n=0; n<100; n++)
    {
      recRes = await provider.getTransactionReceipt(hash);
      console.log(recRes);
      if (recRes != null)
      {
        break;
      }
      await sleep(5);
    }

    console.log("n:"+n);

    for (var i=0; i<recRes.logs.length; i++)
    {
      // IncreaseLiquidity  的操作
      if (recRes.logs[i].topics[0] == '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f')
      { 
        lpPoolPush();
      }
    }
  })
}

async function main() {
  console.log("hello world");

  var monTickUpper;
  var monTickLower;  

  const poolAddress = await factoryContract.getPool(address1, address0,  500)
  console.log('poolAddress', poolAddress.toString())

  var poolData = await getPoolData(poolContract)
  console.log("fee:"+poolData.fee);

  // 监控测试。
  isNeedMonitorInit = 1;
  monitor_hdl();
  while(1)
  {
  	await sleep(5);
  }

  while (1)
  {
    // 监控
    try {
      poolData = await getPoolData(poolContract)
    } catch (error) {
      error.message; // "Oops!"
      
      console.log ("oops .............");
      await sleep(5);
      continue;
    }

    // 方式1：
    quoteAmount = getPriceFromTick(poolData.tick);
    console.log ("1==>tick:"+poolData.tick.toString()+ " price:"+quoteAmount.toString());

/*
    // 方式2：
    ratioX192    = poolData.sqrtPriceX96;
    ratioX192    = JSBI.multiply(ratioX192, ratioX192);
    baseAmount   = JSBI.BigInt(10**decimals0);
    shift        = JSBI.leftShift(JSBI.BigInt(1), JSBI.BigInt(192));
    quoteAmount  = FullMath.mulDivRoundingUp(ratioX192, baseAmount, shift);
    quoteAmount = quoteAmount/(10**decimals1);
    console.log ("2==>tick:"+poolData.tick.toString()+ " price:"+quoteAmount.toString());
*/
    //  (nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2)
    //   (nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2)
    monTickLower = (nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 8);
    quoteAmount = getPriceFromTick(monTickLower);
    console.log ("lower:"+quoteAmount);

    monTickUpper = (nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 8);
    quoteAmount = getPriceFromTick(monTickUpper);
    console.log ("upper:"+quoteAmount);

    console.log (Date.now()/1000);
    await sleep(20);
  }

  const WETH_UNI_POOL = new Pool(
    WethToken,
    UniToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  )
  console.log("fee:"+poolData.fee.toString()+" tick:"+poolData.tick.toString()+ " liquidity:"+poolData.liquidity.toString());



  const position = new Position({
    pool: WETH_UNI_POOL,
    liquidity: ethers.utils.parseUnits('0.01', 18),  // 这里的总的ETH价格
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
  })

  console.log("lower:"+ (nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2));
  console.log("upper:"+ (nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2));  

  const wallet = new ethers.Wallet(WALLET_SECRET)
  const connectedWallet = wallet.connect(provider)

  const approvalAmount = ethers.utils.parseUnits('1', 18).toString()

/*
  const tokenContract0 = new ethers.Contract(address0, ERC20ABI, provider)
  await tokenContract0.connect(connectedWallet).approve(
    positionManagerAddress,
    approvalAmount
  )
  
  const tokenContract1 = new ethers.Contract(address1, ERC20ABI, provider)
  await tokenContract1.connect(connectedWallet).approve(
    positionManagerAddress,
    approvalAmount
  )
*/
  const { amount0: amount0Desired, amount1: amount1Desired} = position.mintAmounts
  // mintAmountsWithSlippage
  console.log("mount0:"+amount0Desired.toString()+" mount1:"+amount1Desired.toString());

  params = {
    token0: address0,
    token1: address1,
    fee: poolData.fee,
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: amount0Desired.toString(),
    amount1Min: amount1Desired.toString(),
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + (60 * 10)
  }

  
  nonfungiblePositionManagerContract.connect(connectedWallet).mint(
    params,                          
    { gasLimit: ethers.utils.hexlify(1000000) }
  ).then(async (res) => {
    console.log("msg out:");
    console.log(res);
    console.log("END");

    const hash = res.hash;
    console.log("hash:"+res.hash);

    var recRes;
    var n;
    for (n=0; n<100; n++)
    {
      recRes = await provider.getTransactionReceipt(hash);
      console.log(recRes);
      if (recRes != null)
      {
        break;
      }
      await sleep(5);
    }

    console.log("n:"+n);

    for (var i=0; i<recRes.logs.length; i++)
    {
      // IncreaseLiquidity  的操作
      if (recRes.logs[i].topics[0] == '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f')
      { 
        console.log("got it: i:"+i);
        for (var j=1; j<recRes.logs[i].topics.length; j++)
        {
          console.log("j:"+j+" "+recRes.logs[i].topics[j]);
        }
      }
    }

  })
  
  
   
}

main()
