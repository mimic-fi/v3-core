import axios, { AxiosError } from 'axios'
import { BigNumber, Contract } from 'ethers'

const SYMBIOSIS_URL = 'https://api-v2.symbiosis.finance/crosschain'

export type CrossChainSwapResponse = { data: { tx: { data: string } } }

export async function getSymbiosisBridgeData(
  srcChainId: number,
  destChainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOutAddress: string,
  amount: BigNumber,
  slippage: number
): Promise<string> {
  try {
    const response = await getBridge(srcChainId, destChainId, sender, tokenIn, tokenOutAddress, amount, slippage)
    return response.data.tx.data
  } catch (error) {
    if (error instanceof AxiosError) throw Error(error.toString() + ' - ' + error.response?.data?.description)
    else throw error
  }
}

async function getBridge(
  srcChainId: number,
  destChainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOutAddress: string,
  amount: BigNumber,
  slippage: number
): Promise<CrossChainSwapResponse> {
  return axios.post(
    `${SYMBIOSIS_URL}/v1/swap`,
    {
      tokenAmountIn: {
        address: tokenIn.address,
        amount: amount.toString(),
        chainId: srcChainId,
        decimals: await tokenIn.decimals(),
      },
      tokenOut: {
        chainId: destChainId,
        address: tokenOutAddress,
        symbol: 'SYMBOL',
        decimals: await tokenIn.decimals(),
      },
      to: sender.address,
      from: sender.address,
      slippage: slippage < 1 ? slippage * 10000 : slippage,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  )
}
