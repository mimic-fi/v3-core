import { currentBlockNumber } from '@mimic-fi/helpers'
import { BigNumber, Contract } from 'ethers'
import fs from 'fs'
import hre from 'hardhat'
import { HardhatNetworkConfig } from 'hardhat/types'
import path from 'path'

import { getSocketBridgeData } from '../../../src/socket'

type Fixture = {
  fromChainId: number
  fromToken: string
  fromAmount: string
  toChainId: number
  toToken: string
  slippage: number
  data: string
}

export async function loadOrGetSocketData(
  sender: Contract,
  fromChainId: number,
  fromToken: Contract,
  fromAmount: BigNumber,
  toChainId: number,
  toToken: Contract,
  slippage: number
): Promise<string> {
  const config = hre.network.config as HardhatNetworkConfig
  const blockNumber = config?.forking?.blockNumber?.toString() || (await currentBlockNumber()).toString()

  const fixture = await readFixture(fromChainId, fromToken, toChainId, toToken, blockNumber)
  if (fixture) return fixture.data

  const data = await getSocketBridgeData(sender, fromChainId, fromToken, fromAmount, toChainId, toToken, slippage)
  await saveFixture(fromChainId, fromToken, fromAmount, toChainId, toToken, slippage, data, blockNumber)
  return data
}

async function readFixture(
  fromChainId: number,
  fromToken: Contract,
  toChainId: number,
  toToken: Contract,
  blockNumber: string
): Promise<Fixture | undefined> {
  const bridgePath = `${await fromToken.symbol()}-${toChainId}.json`
  const fixturePath = path.join(__dirname, 'fixtures', fromChainId.toString(), blockNumber, bridgePath)
  if (!fs.existsSync(fixturePath)) return undefined
  return JSON.parse(fs.readFileSync(fixturePath).toString())
}

async function saveFixture(
  fromChainId: number,
  fromToken: Contract,
  fromAmount: BigNumber,
  toChainId: number,
  toToken: Contract,
  slippage: number,
  data: string,
  blockNumber: string
): Promise<void> {
  const output = {
    fromChainId: fromChainId,
    fromToken: fromToken.address,
    fromAmount: fromAmount.toString(),
    toChainId: toChainId,
    toToken: toToken.address,
    slippage,
    data,
  }

  const fixturesPath = path.join(__dirname, 'fixtures')
  if (!fs.existsSync(fixturesPath)) fs.mkdirSync(fixturesPath)

  const networkPath = path.join(fixturesPath, fromChainId.toString())
  if (!fs.existsSync(networkPath)) fs.mkdirSync(networkPath)

  const blockNumberPath = path.join(networkPath, blockNumber)
  if (!fs.existsSync(blockNumberPath)) fs.mkdirSync(blockNumberPath)

  const bridgePath = path.join(blockNumberPath, `${await fromToken.symbol()}-${toChainId}.json`)
  fs.writeFileSync(bridgePath, JSON.stringify(output, null, 2))
}
