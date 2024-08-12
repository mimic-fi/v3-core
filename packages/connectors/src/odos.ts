import axios, { AxiosError } from 'axios'
import { BigNumber, Contract } from 'ethers'

const ODOS_URL = 'https://api.odos.xyz'
export type SwapResponse = { data: { transaction: { data: string } } }

export async function getOdosSwapData(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber,
  slippage: number
): Promise<string> {
  try {
    const response = await getSwap(chainId, sender, tokenIn, tokenOut, amountIn, slippage)
    return response.data.transaction.data
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
  const response = await axios.post(
    `${ODOS_URL}/sor/quote/v2`,
    {
      chainId,
      inputTokens: [
        {
          tokenAddress: tokenIn.address,
          amount: amountIn.toString(),
        },
      ],
      outputTokens: [
        {
          tokenAddress: tokenOut.address,
          proportion: 1,
        },
      ],
      userAddr: sender.address,
      slippageLimitPercent: slippage < 1 ? slippage * 100 : slippage, // The value is 0.5 -> 0.5%
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  )
  const pathId = response.data.pathId
  return await axios.post(
    `${ODOS_URL}/sor/assemble`,
    {
      userAddr: sender.address,
      pathId: pathId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  )
}
