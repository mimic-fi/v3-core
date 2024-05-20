import axios, { AxiosError } from 'axios'
import { BigNumber, Contract } from 'ethers'

const BEBOP_URL = 'https://api.bebop.xyz/pmm'

const CHAIN_NAMES = {
  42161: 'arbitrum',
  8453: 'base',
}

export type SwapResponse = { data: { tx: { data: string } } }

export async function getBebopSwapData(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber
): Promise<string> {
  try {
    const response = await getSwap(chainId, sender, tokenIn, tokenOut, amountIn)
    return response.data.tx.data
  } catch (error) {
    if (error instanceof AxiosError) throw Error(error.toString() + ' - ' + error.response?.data?.description)
    else throw error
  }
}

async function getSwap(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber
): Promise<SwapResponse> {
  const chainName = CHAIN_NAMES[chainId]
  if (!chainName) throw Error('Unsupported chain id')

  return axios.get(`${BEBOP_URL}/${chainName}/v3/quote`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    params: {
      taker_address: sender.address,
      sell_tokens: tokenIn.address,
      buy_tokens: tokenOut.address,
      sell_amounts: amountIn.toString(),
      gasless: false,
      skip_validation: true,
    },
  })
}
