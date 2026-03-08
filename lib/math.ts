// A generic utility function used for human readable price parsing
import { ethers } from "ethers";

export function getHumanReadablePrice(sqrtPriceX96: bigint, decimalsToken0: number, decimalsToken1: number): string {
    // price = (sqrtPriceX96 / 2^96)^2
    // We adjust for decimals by multiplying by 10^(decimalsToken0 - decimalsToken1)
    if (!sqrtPriceX96 || sqrtPriceX96 === 0n) return "0.000";

    const Q96 = 2n ** 96n;

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
