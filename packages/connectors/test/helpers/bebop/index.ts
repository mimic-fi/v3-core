import { currentBlockNumber } from '@mimic-fi/v3-helpers'
import { BigNumber, Contract } from 'ethers'
import fs from 'fs'
import hre from 'hardhat'
import { HardhatNetworkConfig } from 'hardhat/types'
import path from 'path'

import { getBebopSwapData } from '../../../src/bebop'

type Fixture = {
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippage: number
  data: string
}

export async function loadOrGetBebopSwapData(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber
): Promise<string> {
  const config = hre.network.config as HardhatNetworkConfig
  const blockNumber = config?.forking?.blockNumber?.toString() || (await currentBlockNumber()).toString()

  const fixture = await readFixture(chainId, tokenIn, tokenOut, blockNumber)
  if (fixture) return fixture.data

  const data = await getBebopSwapData(chainId, sender, tokenIn, tokenOut, amountIn)
  await saveFixture(chainId, tokenIn, tokenOut, amountIn, data, blockNumber)
  return data
}

async function readFixture(
  chainId: number,
  tokenIn: Contract,
  tokenOut: Contract,
  blockNumber: string
): Promise<Fixture | undefined> {
  const swapPath = `${await tokenIn.symbol()}-${await tokenOut.symbol()}.json`
  const fixturePath = path.join(__dirname, 'fixtures', chainId.toString(), blockNumber, swapPath)
  if (!fs.existsSync(fixturePath)) return undefined
  return JSON.parse(fs.readFileSync(fixturePath).toString())
}

async function saveFixture(
  chainId: number,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber,
  data: string,
  blockNumber: string
): Promise<void> {
  const output = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn: amountIn.toString(),
    data,
  }

  const fixturesPath = path.join(__dirname, 'fixtures')
  if (!fs.existsSync(fixturesPath)) fs.mkdirSync(fixturesPath)

  const networkPath = path.join(fixturesPath, chainId.toString())
  if (!fs.existsSync(networkPath)) fs.mkdirSync(networkPath)

  const blockNumberPath = path.join(networkPath, blockNumber)
  if (!fs.existsSync(blockNumberPath)) fs.mkdirSync(blockNumberPath)

  const swapPath = path.join(blockNumberPath, `${await tokenIn.symbol()}-${await tokenOut.symbol()}.json`)
  fs.writeFileSync(swapPath, JSON.stringify(output, null, 2))
}
