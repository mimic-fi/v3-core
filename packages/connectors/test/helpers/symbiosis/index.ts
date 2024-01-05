import { currentBlockNumber } from '@mimic-fi/v3-helpers'
import { BigNumber, Contract } from 'ethers'
import fs from 'fs'
import hre from 'hardhat'
import { HardhatNetworkConfig } from 'hardhat/types'
import path from 'path'

import { getSymbiosisBridgeData } from '../../../src/symbiosis'

export async function loadOrGetSymbiosisBridgeData(
  srcChainId: number,
  destChainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOutAddress: string,
  amount: BigNumber,
  slippage: number
): Promise<string> {
  const config = hre.network.config as HardhatNetworkConfig
  const blockNumber = config?.forking?.blockNumber?.toString() || (await currentBlockNumber()).toString()

  const fixture = await readFixture(srcChainId, destChainId, tokenIn, blockNumber)
  if (fixture) return fixture.data

  const data = await getSymbiosisBridgeData(srcChainId, destChainId, sender, tokenIn, tokenOutAddress, amount, slippage)
  await saveFixture(srcChainId, destChainId, sender, tokenIn, tokenOutAddress, amount, slippage, data, blockNumber)
  return data
}

async function readFixture(
  srcChainId: number,
  destChainId: number,
  token: Contract,
  blockNumber: string
): Promise<Fixture | undefined> {
  const bridgePath = `${await token.symbol()}-${destChainId}.json`
  const fixturePath = path.join(__dirname, 'fixtures', srcChainId.toString(), blockNumber, bridgePath)
  if (!fs.existsSync(fixturePath)) return undefined
  return JSON.parse(fs.readFileSync(fixturePath).toString())
}

async function saveFixture(
  srcChainId: number,
  destChainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOutAddress: string,
  amount: BigNumber,
  slippage: number,
  data: string,
  blockNumber: string
): Promise<void> {
  const output = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOutAddress,
    amountIn: amount.toString(),
    slippage,
    data,
  }

  const fixturesPath = path.join(__dirname, 'fixtures')
  if (!fs.existsSync(fixturesPath)) fs.mkdirSync(fixturesPath)

  const networkPath = path.join(fixturesPath, srcChainId.toString())
  if (!fs.existsSync(networkPath)) fs.mkdirSync(networkPath)

  const blockNumberPath = path.join(networkPath, blockNumber)
  if (!fs.existsSync(blockNumberPath)) fs.mkdirSync(blockNumberPath)

  const bridgePath = path.join(blockNumberPath, `${await tokenIn.symbol()}-${destChainId}.json`)
  fs.writeFileSync(bridgePath, JSON.stringify(output, null, 2))
}
