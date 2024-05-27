import axios, { AxiosError } from 'axios'
import { BigNumber, Contract } from 'ethers'

const KYBER_SWAP_URL = 'https://aggregator-api.kyberswap.com'
export type SwapResponse = { data: { data: { data: string } } }

const CHAINS: { [key: number]: string } = {
  1: 'ethereum',
  8453: 'base',
}

export async function getKyberSwapSwapData(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber,
  slippage: number
): Promise<string> {
  try {
    const response = await getSwap(chainId, sender, tokenIn, tokenOut, amountIn, slippage)
    return response.data.data.data
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
  amountIn: BigNumber,
  slippage: number
): Promise<SwapResponse> {
  const chain = CHAINS[chainId]
  const response = await axios.get(`${KYBER_SWAP_URL}/${chain}/api/v1/routes`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    params: {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn: amountIn.toString(),
      saveGas: true,
    },
  })

  // The value is in ranges [0, 2000], 10 means 0.1%
  const slippageTolerance = Math.floor(slippage < 1 ? slippage * 10000 : slippage)
  return await axios.post(
    `${KYBER_SWAP_URL}/${chain}/api/v1/route/build`,
    {
      routeSummary: response.data.data.routeSummary,
      slippageTolerance,
      sender: sender.address,
      recipient: sender.address,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  )
}
