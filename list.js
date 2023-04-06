const { Contract, ethers } = require('ethers');
const { TickMath, Position } = require('@uniswap/v3-sdk');
const { abi: iUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json');
const { abi: iUniswapV3PoolStateABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json');

const provider = new ethers.providers.JsonRpcProvider('https://arb-mainnet.g.alchemy.com/v2/dKULT3A2vNWeOl73D4I9sG3ANoTPmoxB');
const userAddress = '0xcafebabe39f225d358d7454b554b0cfeb25feee2'; // 要查询的账户地址
const poolAddress = "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443"; // Uniswap V3的交易对合约地址


const main = async() => {
	

//	return ;
	const poolContract = new Contract(poolAddress, iUniswapV3PoolABI, provider);
	const poolStateContract = new Contract(poolAddress, iUniswapV3PoolStateABI, provider);
	
	console.log("1");

	const token0 = await poolContract.token0();
	const token1 = await poolContract.token1();
	const tickSpacing = await poolContract.tickSpacing();
	
	console.log("t0:"+token0 + " t2:"+token1);


	Bytes32 strInBytes = new Bytes32(userAddress);
	const positions = await poolStateContract.positions(strInBytes);


	console.log("3");


	for (let i = 0; i < positions.length; i++) {
		  const { tickLower, tickUpper, liquidity } = positions[i];
		  const position = new Position({ tickLower, tickUpper, liquidity });
	
		  const priceLower = position.priceAt(TickMath.MIN_TICK).toSignificant(6);
		  const priceUpper = position.priceAt(TickMath.MAX_TICK).toSignificant(6);

		  console.log(`LP position ${i + 1}:`);
		  console.log(`- Liquidity: ${liquidity}`);
		  console.log(`- Price range: ${priceLower} to ${priceUpper}`);
	}

}


main();
