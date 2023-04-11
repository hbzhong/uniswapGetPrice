/*
策略：
1.检测45分钟，没有越界。则进入组LP。
2.组LP的时间最长2小时，超过2小时就，找机会在进入的点退出。
3.如果越界则退出，swap拿回放进去的ETH。
*/

const { ethers } = require('ethers')
const { Token } = require('@uniswap/sdk-core')
const { TickMath, FullMath, Pool, Position, nearestUsableTick } = require('@uniswap/v3-sdk')
const { abi: IUniswapV3PoolABI }  = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const { abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json')
const { abi: UniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
const JSBI = require('jsbi');
const readline = require('readline');
//const ERC20ABI = require('./abi.json')

require('dotenv').config()
const INFURA_URL_TESTNET = process.env.PROVIDE_URL
const WALLET_ADDRESS = process.env.WALLET_ADDR
const WALLET_SECRET = process.env.WALLET_SECRET
const chainId = 42161

const json_wallet = '{"address":"937ac623cad8545346b2bf8e5e15445c6e265f6f","id":"2340b104-b52d-46e7-a031-8ead46792a5f","version":3,"crypto":{"cipher":"aes-128-ctr","cipherparams":{"iv":"54a9d13ba2d09a98f04a62e328a56106"},"ciphertext":"200bee3a2f52512622eadd9b731c21c0c9ba7bc1fe4c6f12b1e4bbccd0eef7e8","kdf":"scrypt","kdfparams":{"salt":"00ed9bc5b89cba9959c9b45d5dc0a2e5b26b68fd387628cb0234395b0dc7ac91","n":131072,"dklen":32,"p":1,"r":8},"mac":"17e1d93fc6db87a807b308529e33cb2241ae6e4fc57add2ef653614777da08b9"}}'
var wallet_password;
var wallet_hdl;


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

// 存放make lp的tick
var make_lp_tick = 0;
var make_lp_upper_tick = 0;
var make_lp_lower_tick = 0;
var make_lp_tick_space = 0;

//监控的时间
const time_monitor = 45*60;
const time_exit_monitor = 2*60*60;

var is_need_swap = 0;

async function swap_e2u(inputAmountETH)
{
  // 5分钟
  const deadline = Math.floor(Date.now()/1000 + 60*5);

  const params = {
    tokenIn: address0,
    tokenOut: address1,
    fee: fee,
    recipient: process.env.WALLET_ADDR,
    deadline: deadline,
    amountIn: inputAmountETH,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  }

  // 直接使用ETH就可以交易，可以省点gas费用
  const data = router.interface.encodeFunctionData("exactInputSingle", [params])

  // 使用WETH进行交易，过一手
  //  const data = router.exactInputSingle(params);
  const txArgs = {
    to: process.env.ROUTER_ADDR,
    from: process.env.WALLET_ADDR,
    data: data,
    value: inputAmountETH,
    gasLimit:'1000000'
  }

  console.log("sending");
  const tx = await signer.sendTransaction(txArgs);
  const receipt = await tx.wait();
  console.log('complete....');
}

async function swap_u2e(inputAmountU)
{
  // 5分钟
  const deadline = Math.floor(Date.now()/1000 + 60*5);

  const params = {
    tokenIn: address1,
    tokenOut: address0,
    fee: fee,
    recipient: process.env.WALLET_ADDR,
    deadline: deadline,
    amountIn: inputAmountU,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  }

  // 直接使用ETH就可以交易，可以省点gas费用
  const data = router.interface.encodeFunctionData("exactInputSingle", [params])

  // 使用WETH进行交易，过一手
  //  const data = router.exactInputSingle(params);
  const txArgs = {
    to: process.env.ROUTER_ADDR,
    from: process.env.WALLET_ADDR,
    data: data,
    value: inputAmountU,
    gasLimit:'1000000'
  }

  console.log("sending");
  const tx = await signer.sendTransaction(txArgs);
  const receipt = await tx.wait();
  console.log('complete....');
}

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
//	    console.log ("lower:"+cur_lp_lower_temp);

	    // upper
	    monTickUpper = (nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 8);
	    cur_lp_upper_temp = getPriceFromTick(monTickUpper);
//	    console.log ("upper:"+cur_lp_upper_temp);

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
	    if (cnt >= (time_monitor/20))
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
//  console.log('poolAddress', poolAddress.toString())

  var poolData = await getPoolData(poolContract)
//  console.log("fee:"+poolData.fee);

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
    liquidity: ethers.utils.parseUnits('0.5', 18),  // 这里的总的ETH价格
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

  
  make_lp_tick = poolData.tick;
  make_lp_upper_tick = nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 8;
  make_lp_lower_tick = nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 8;
  make_lp_tick_space = poolData.tickSpacing;

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
//        lp_token_id = recRes.logs[i].topics[1];        
//        lp_eth_amount = amount0Desired;
//        lp_usdc_amount = amount1Desired;

        lp_token_id = utils.defaultAbiCoder.decode(['uint256'], recRes.logs[i].topics[1]);
        console.log("token ID: "+ lp_token_id.toString());

        recData = utils.defaultAbiCoder.decode(['uint128', 'uint256', 'uint256'], recRes.logs[i].data);

        lp_eth_amount = recData[1].toString();
        lp_usdc_amount = recData[2].toString();

        console.log("liquidity:"+recData[0].toString())
        console.log("amount0 "+recData[1].toString())
        console.log("amount1 "+recData[2].toString())            
        break;
      }
    }
  })
}

async function rm_lp()
{
  // 利用 lp_token_id
  const connectedWallet = wallet_hdl.connect(provider)

  nonfungiblePositionManagerContract.connect(connectedWallet).positions(
    lp_token_id.toString()
  ).then((res) => {
    const totalLiquidity = res.liquidity;
    params = {
      tokenId: lp_token_id,
      liquidity: totalLiquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(Date.now()/1000) + 60*5
    }

    nonfungiblePositionManagerContract.connect(connectedWallet).decreaseLiquidity(
      params,
      { gasLimit: ethers.utils.hexlify(1000000) }
    ).then (async(res) => {
      //hash: 0x341053a3e3651f80e60be3bf94564f5729be6134036f2d3e0f1ed7f3f5299f14
      console.log(res);

      const hash = res.hash;
      console.log("hash:"+res.hash);

      var recRes;
      var n;
      var tokenID;
      var recData;
      for (n=0; n<100; n++)
      {
        recRes = await provider.getTransactionReceipt(hash);
        console.log(recRes);
        if (recRes != null)
        {
          break;
        }
        await sleep(1);
      }

      //arg1 == 格式， arg2 == data内容
      console.log("n:"+n);

      for (var i=0; i<recRes.logs.length; i++)
      {
        //DecreaseLiquidity (index_topic_1 uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)View Source
        if (recRes.logs[i].topics[0] == '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4')
        { 
          var rm_eth_amount;
          var rm_usdc_amount;

          tokenID = utils.defaultAbiCoder.decode(['uint256'], recRes.logs[i].topics[1]);
          console.log("token ID: "+ tokenID[0].toString());

          recData = utils.defaultAbiCoder.decode(['uint128', 'uint256', 'uint256'], recRes.logs[i].data);
          rm_eth_amount = recData[1];
          rm_usdc_amount = recData[2];
          console.log("liquidity:"+recData[0].toString())
          console.log("amount0 "+recData[1].toString())  //eth 
          console.log("amount1 "+recData[2].toString())  // usdc

          // 往上越界了，满手的U
          if (is_need_swap == 1)
          {
            console.log("swap_u2e");
            swap_u2e(rm_usdc_amount/2);
          }
          
          // 往下越界了，满手的E
          if (is_need_swap == 2)
          {
            console.log("swap_e2u");
            swap_e2u(rm_eth_amount/2);
          }          
          break;
        }
      } 
    })
  })  
}

async function get_wallet_json()
{
  const wallet1 = new ethers.Wallet(WALLET_SECRET)  
  wallet1.encrypt("helloworld").then(function(json) {
    console.log(json);
  });
}


async function import_wallet()
{
  /* 获取 密码*/
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.stdoutMuted = true;

  rl.question('Password: ', function(password) {
    wallet_password = password;
    rl.close();
  });

  rl._writeToOutput = function _writeToOutput(stringToWrite) {
    if (rl.stdoutMuted)
      rl.output.write("*");
    else
      rl.output.write(stringToWrite);
  };
  await sleep(10);
  // 获取到钱包
  ethers.Wallet.fromEncryptedJson(json_wallet, wallet_password).then(function(wallet) {
    wallet_hdl = wallet;
    console.log ("import ok");
  }, function(error) {
    console.log(error)
    return;
  });
}

async function monitor_to_exit()
{ 
    var cnt;
    var cur_lp_price_temp = 0;
    var poolData;
    var is_need_exit;

    cnt = 0;
    is_need_exit = 0;
    is_need_swap = 0;

    console.log("[monitor_to_exit] ENTER");
    while (1)
    {
	    // 监控
	    try {
	        poolData = await getPoolData(poolContract)
	    } catch (error) {
	        error.message; // "Oops!"
	      
	        await sleep(5);
	        continue;
	    }
	    
	    //  当前价格越界
	    if (make_lp_upper_tick < poolData.tick)	         
	    {
	    	console.log("[monitor_to_exit] 向上越界了");    	
        is_need_swap = 1;
        break;
	    }

      if (make_lp_lower_tick > poolData.tick)
      {
	    	console.log("[monitor_to_exit] 向下越界了");    	
        is_need_swap = 2;
        break;        
      }
	    
	    await sleep(20);	
	    cnt++;
	    if (cnt >= (time_exit_monitor/20))
	    {
	    	// 可以去组LP监控完成
	    	console.log("> 2 hours, need to exit");        
	    	is_need_exit = 1;        
	    }

      if (is_need_exit)
      {
        var upper;
        var lower;

        upper = nearestUsableTick(make_lp_tick, make_lp_tick_space) + make_lp_tick_space * 1;
        lower = nearestUsableTick(make_lp_tick, make_lp_tick_space) - make_lp_tick_space * 1;        
        if ((poolData.tick > lower)
          && (poolData.tick < upper))
        {
            // OK 消除然后退出
            is_need_swap = 0;
            console.log("> 2 hours, exit ok");     
            break;
        }
      }
    }

    // OK 消除LP，然后退出
    rm_lp();  
}

async function main() {

/*
  var monTickUpper;
  var monTickLower;  

  const poolAddress = await factoryContract.getPool(address1, address0,  500)
  console.log('poolAddress', poolAddress.toString())

  var poolData = await getPoolData(poolContract)
  console.log("fee:"+poolData.fee);
*/
/*
  const wallet1 = new ethers.Wallet(WALLET_SECRET)  
  wallet1.encrypt("helloworld").then(function(json) {
    console.log(json);
  });

  while(1)
  {
    sleep(1);
  }
*/
  
//  import_wallet();

  /* 获取 密码*/
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.stdoutMuted = true;

  rl.question('Password: ', function(password) {
    wallet_password = password;
    rl.close();
  });

  rl._writeToOutput = function _writeToOutput(stringToWrite) {
    if (rl.stdoutMuted)
      rl.output.write("*");
    else
      rl.output.write(stringToWrite);
  };
  await sleep(10);
  // 获取到钱包
  ethers.Wallet.fromEncryptedJson(json_wallet, wallet_password).then(function(wallet) {
    wallet_hdl = wallet;
    console.log ("import ok");
  }, function(error) {
    console.log(error)
    return;
  });

  while (1)
  {
    isNeedMonitorInit = 1;
    monitor_hdl();  

//    make_lp();
    
//    monitor_to_exit();
  }
  
}

main()
