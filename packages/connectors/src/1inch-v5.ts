import axios, { AxiosError } from 'axios'
import { BigNumber, Contract } from 'ethers'

const ONE_INCH_URL = 'https://api.1inch.dev/swap/v5.2'
const ONE_INCH_API_KEY = process.env.ONE_INCH_API_KEY

export type SwapResponse = { data: { tx: { data: string } } }

export async function get1inchSwapData(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber,
  slippage: number
): Promise<string> {
  try {
    const response = await getSwap(chainId, sender, tokenIn, tokenOut, amountIn, slippage)
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
  amountIn: BigNumber,
  slippage: number
): Promise<SwapResponse> {
  return axios.get(`${ONE_INCH_URL}/${chainId}/swap`, {
    headers: {
      Authorization: `Bearer ${ONE_INCH_API_KEY}`,
      Accept: 'application/json',
    },
    params: {
      disableEstimate: true,
      fromAddress: sender.address,
      fromTokenAddress: tokenIn.address,
      toTokenAddress: tokenOut.address,
      amount: amountIn.toString(),
      slippage: slippage < 1 ? slippage * 100 : slippage,
    },
  })
}
