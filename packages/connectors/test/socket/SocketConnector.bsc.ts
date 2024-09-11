import { deploy, fp, tokens } from '@mimic-fi/v3-helpers'

import { itBehavesLikeSocketConnector } from './SocketConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const SOCKET_GATEWAY = '0x3a23F943181408EAC424116Af7b7790c94Cb97a5'

const WHALE = '0x8894e0a0c962cb723c1976a4421c95949be2d4e3'

describe('SocketConnector', () => {
  const fromChainId = 56
  const fromToken = tokens.bsc.USDC
  const fromAmount = fp(50000)

  before('create socket connector', async function () {
    this.connector = await deploy('SocketConnector', [SOCKET_GATEWAY])
  })

  context('to mainnet', () => {
    const toChainId = 1
    const toToken = tokens.mainnet.USDC

    itBehavesLikeSocketConnector(fromChainId, fromToken, fromAmount, toChainId, toToken, WHALE)
  })

  context('to optimism', () => {
    const toChainId = 10
    const toToken = tokens.optimism.USDC

    itBehavesLikeSocketConnector(fromChainId, fromToken, fromAmount, toChainId, toToken, WHALE)
  })
})
