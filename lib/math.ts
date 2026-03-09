// A generic utility function used for human readable price parsing
import { ethers } from "ethers";

export function getHumanReadablePrice(sqrtPriceX96: bigint, decimalsToken0: number, decimalsToken1: number): string {
    // price = (sqrtPriceX96 / 2^96)^2
    // We adjust for decimals by multiplying by 10^(decimalsToken0 - decimalsToken1)
    if (!sqrtPriceX96 || sqrtPriceX96 === BigInt(0)) return "0.000";

    const Q96 = BigInt(2) ** BigInt(96);
    
    // Use string math for higher precision or just calculate via Number for simplicity since JS max safe float handles UI display
    const rawPrice = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
    const decimalAdjustmentFactor = 10 ** (decimalsToken0 - decimalsToken1);
    
    const truePrice = rawPrice * decimalAdjustmentFactor;

    return truePrice.toLocaleString(undefined, {
      minimumSignificantDigits: 2,
      maximumSignificantDigits: 6
    });
}

export function getPoolKeyOnly(meta: any) {
  return {
    currency0: meta.currency0,
    currency1: meta.currency1,
    fee: Number(meta.fee),
    tickSpacing: Number(meta.tickSpacing),
    hooks: meta.hooks
  };
}

export function computePoolId(meta: any) {
  const key = getPoolKeyOnly(meta);
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    )
  );
}

const Q96 = BigInt(2) ** BigInt(96);

export function getSqrtPriceAtTick(tick: number): bigint {
  const sqrtPrice = Math.pow(1.0001, tick / 2) * Math.pow(2, 96);
  return BigInt(Math.floor(sqrtPrice));
}

export function getLiquidityDelta(
  amount0: bigint,
  amount1: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number
): bigint {
  const sqrtPriceLower = getSqrtPriceAtTick(tickLower);
  const sqrtPriceUpper = getSqrtPriceAtTick(tickUpper);

  // If price is below range, liquidity is only from token0
  if (sqrtPriceX96 <= sqrtPriceLower) {
      return (amount0 * sqrtPriceLower * sqrtPriceUpper) / ((sqrtPriceUpper - sqrtPriceLower) * Q96);
  } 
  // If price is above range, liquidity is only from token1
  else if (sqrtPriceX96 >= sqrtPriceUpper) {
      return (amount1 * Q96) / (sqrtPriceUpper - sqrtPriceLower);
  }
  // If price is in range, we take the minimum of the two
  else {
      const liq0 = (amount0 * sqrtPriceX96 * sqrtPriceUpper) / ((sqrtPriceUpper - sqrtPriceX96) * Q96);
      const liq1 = (amount1 * Q96) / (sqrtPriceX96 - sqrtPriceLower);
      return liq0 < liq1 ? liq0 : liq1;
  }
}

export function getTickFromPrice(price: number, spacing: number): number {
  if (price <= 0) return 0;
  const tick = Math.log(price) / Math.log(1.0001);
  return Math.round(tick / spacing) * spacing;
}
