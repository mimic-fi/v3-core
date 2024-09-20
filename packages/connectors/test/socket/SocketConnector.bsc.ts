import { deploy, fp } from '@mimic-fi/helpers'

import { itBehavesLikeSocketConnector } from './SocketConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const SOCKET_GATEWAY = '0x3a23F943181408EAC424116Af7b7790c94Cb97a5'

const WHALE = '0x8894e0a0c962cb723c1976a4421c95949be2d4e3'

describe('SocketConnector', () => {
  const fromChainId = 56
  const fromToken = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
  const fromAmount = fp(50000)

  before('create socket connector', async function () {
    this.connector = await deploy('SocketConnector', [SOCKET_GATEWAY])
  })

  context('to mainnet', () => {
    const toChainId = 1
    const toToken = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    itBehavesLikeSocketConnector(fromChainId, fromToken, fromAmount, toChainId, toToken, WHALE)
  })

  context('to optimism', () => {
    const toChainId = 10
    const toToken = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'

    itBehavesLikeSocketConnector(fromChainId, fromToken, fromAmount, toChainId, toToken, WHALE)
  })
})
