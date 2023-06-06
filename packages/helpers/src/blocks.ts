import { BigNumber } from 'ethers'

import { bn } from './numbers'

export const incrementBlocks = async (blocks: number): Promise<void> => {
  const { ethers } = await import('hardhat')
  for (let i = 0; i < blocks; i++) await ethers.provider.send('evm_mine', [])
}

export const currentBlock = async (): Promise<{ number: number; timestamp: number }> => {
  const { network } = await import('hardhat')
  return network.provider.send('eth_getBlockByNumber', ['latest', true])
}

export const currentBlockNumber = async (): Promise<BigNumber> => {
  const { number } = await currentBlock()
  return bn(number)
}
