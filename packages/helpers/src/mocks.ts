import { Contract } from 'ethers'

import { deploy } from './contracts'
import { BigNumberish } from './numbers'

/* eslint-disable no-secrets/no-secrets */

export async function deployWrappedNativeTokenMock(): Promise<Contract> {
  return deploy('@mimic-fi/v3-helpers/artifacts/contracts/mocks/WrappedNativeTokenMock.sol/WrappedNativeTokenMock')
}

export async function deployTokenMock(symbol: string, decimals = 18): Promise<Contract> {
  return deploy('@mimic-fi/v3-helpers/artifacts/contracts/mocks/TokenMock.sol/TokenMock', [symbol, decimals])
}

export async function deployFeedMock(price: BigNumberish, decimals = 18): Promise<Contract> {
  return deploy('@mimic-fi/v3-helpers/artifacts/contracts/mocks/FeedMock.sol/FeedMock', [price, decimals])
}
