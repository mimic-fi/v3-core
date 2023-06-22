import { bn, currentTimestamp, MINUTE, pct } from '@mimic-fi/v3-helpers'
import axios, { AxiosError } from 'axios'
import { BigNumber, Contract } from 'ethers'

const PARASWAP_URL = 'https://apiv5.paraswap.io'

export type PricesResponse = { data: { priceRoute: { [key: string]: string } } }

export type TransactionsResponse = { data: { data: string; sig: string; signer: string } }

export type SwapData = {
  data: string
  sig: string
  signer: string
  minAmountOut: BigNumber
  expectedAmountOut: BigNumber
}

export async function getParaswapSwapData(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber,
  slippage: number
): Promise<SwapData> {
  const prices = await getPrices(chainId, sender, tokenIn, tokenOut, amountIn)
  const priceRoute = prices.data.priceRoute

  try {
    const { destAmount } = priceRoute
    const minAmountOut = bn(destAmount).sub(pct(bn(destAmount), slippage))
    const transactions = await postTransactions(chainId, sender, tokenIn, tokenOut, amountIn, minAmountOut, priceRoute)
    const { data, sig, signer } = transactions.data
    return { data, sig, signer, minAmountOut, expectedAmountOut: bn(destAmount) }
  } catch (error) {
    if (error instanceof AxiosError) throw Error(error.toString() + ' - ' + error.response?.data?.error)
    else throw error
  }
}

export async function getPrices(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber
): Promise<PricesResponse> {
  return axios.get(`${PARASWAP_URL}/prices`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    params: {
      srcToken: tokenIn.address,
      srcDecimals: await tokenIn.decimals(),
      destToken: tokenOut.address,
      destDecimals: await tokenOut.decimals(),
      amount: amountIn.toString(),
      side: 'SELL',
      network: chainId,
      userAddress: sender.address,
    },
  })
}

export async function postTransactions(
  chainId: number,
  sender: Contract,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: BigNumber,
  minAmountOut: BigNumber,
  priceRoute: { [key: string]: string }
): Promise<TransactionsResponse> {
  const { ethers } = await import('hardhat')
  return axios.post(
    `${PARASWAP_URL}/transactions/${chainId}`,
    {
      srcToken: tokenIn.address,
      destToken: tokenOut.address,
      srcAmount: amountIn.toString(),
      srcDecimals: await tokenIn.decimals(),
      destAmount: minAmountOut.toString(),
      destDecimals: await tokenOut.decimals(),
      userAddress: sender.address,
      receiver: sender.address,
      deadline: (await currentTimestamp()).add(MINUTE).toString(),
      priceRoute,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      params: {
        gasPrice: (await ethers.provider.getGasPrice()).toString(),
        signCalldata: true,
        ignoreChecks: true,
      },
    }
  )
}
