import axios, { AxiosError } from 'axios'
import { BigNumber, Contract } from 'ethers'

const SOCKET_URL = 'https://api.socket.tech/v2'
const SOCKET_API_KEY = '72a5b4b0-e727-48be-8aa1-5da9d62fe635'

/* eslint-disable @typescript-eslint/no-explicit-any */

export type QuoteResponse = { data: { result: { routes: any[] } } }
export type TransactionDataResponse = { data: { result: { txData: string } } }

export async function getSocketBridgeData(
  sender: Contract,
  fromChainId: number,
  fromToken: Contract,
  fromAmount: BigNumber,
  toChainId: number,
  toToken: Contract,
  slippage: number
): Promise<string> {
  try {
    const quote = await getQuote(sender, fromChainId, fromToken, fromAmount, toChainId, toToken, slippage)
    const transaction = await getTransactionData(quote.data.result.routes[0])
    return transaction.data.result.txData
  } catch (error) {
    if (error instanceof AxiosError) throw Error(error.toString() + ' - ' + error.response?.data?.description)
    else throw error
  }
}

async function getQuote(
  sender: Contract,
  fromChainId: number,
  fromToken: Contract,
  fromAmount: BigNumber,
  toChainId: number,
  toToken: Contract,
  slippage: number
): Promise<QuoteResponse> {
  return axios.get(`${SOCKET_URL}/quote`, {
    headers: {
      'API-KEY': SOCKET_API_KEY,
      Accept: 'application/json',
    },
    params: {
      userAddress: sender.address,
      fromChainId: fromChainId,
      fromTokenAddress: fromToken.address,
      fromAmount: fromAmount.toString(),
      toChainId: toChainId,
      toTokenAddress: toToken.address,
      defaultBridgeSlippage: slippage < 1 ? slippage * 100 : slippage,
      singleTxOnly: true,
      uniqueRoutesPerBridge: true,
      sort: 'output',
      includeDexes: ['oneinch', 'rainbow'],
      includeBridges: ['cctp', 'celer', 'connext', 'hop', 'stargate'],
    },
  })
}

async function getTransactionData(route: any): Promise<TransactionDataResponse> {
  return axios.post(
    `${SOCKET_URL}/build-tx`,
    { route },
    {
      headers: {
        'API-KEY': SOCKET_API_KEY,
        Accept: 'application/json',
      },
    }
  )
}
