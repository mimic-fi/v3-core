import { deploy, fp, impersonate, instanceAt, MAX_UINT256, toUSDC, ZERO_ADDRESS } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'
const SOURCE_CHAIN_ID = 1

describe('HopBridgeConnector', () => {
  let connector: Contract, usdc: Contract, weth: Contract, whale: SignerWithAddress

  before('create hop connector', async function () {
    connector = await deploy('HopBridgeConnector', [WETH])
  })

  before('load tokens and accounts', async () => {
    usdc = await instanceAt('IERC20', USDC)
    weth = await instanceAt('IERC20', WETH)
    whale = await impersonate(WHALE, fp(100))
  })

  context('WETH', () => {
    const HOP_ETH_BRIDGE = '0xb8901acB165ed027E32754E0FFe830802919727f'

    context('when the recipient is not the zero address', async () => {
      function bridgesToL2Properly(destinationChainId: number) {
        const slippage = fp(0.03)
        const deadline = MAX_UINT256
        const amount = toUSDC(300)
        const minAmountOut = amount.sub(amount.mul(slippage).div(fp(1)))
        const relayer = ZERO_ADDRESS
        const relayerFee = 0

        if (destinationChainId != SOURCE_CHAIN_ID) {
          it('should send the tokens to the bridge', async () => {
            const previousWethSenderBalance = await weth.balanceOf(whale.address)
            const previousWethBridgeBalance = await weth.balanceOf(HOP_ETH_BRIDGE)
            const previousWethConnectorBalance = await weth.balanceOf(connector.address)
            const previousEthBridgeBalance = await ethers.provider.getBalance(HOP_ETH_BRIDGE)

            await weth.connect(whale).transfer(connector.address, amount)
            await connector
              .connect(whale)
              .execute(
                destinationChainId,
                WETH,
                amount,
                minAmountOut,
                whale.address,
                HOP_ETH_BRIDGE,
                deadline,
                relayer,
                relayerFee
              )

            const currentWethSenderBalance = await weth.balanceOf(whale.address)
            expect(currentWethSenderBalance).to.be.equal(previousWethSenderBalance.sub(amount))

            const currentWethBridgeBalance = await weth.balanceOf(HOP_ETH_BRIDGE)
            expect(currentWethBridgeBalance).to.be.equal(previousWethBridgeBalance)

            const currentEthBridgeBalance = await ethers.provider.getBalance(HOP_ETH_BRIDGE)
            expect(currentEthBridgeBalance).to.be.equal(previousEthBridgeBalance.add(amount))

            const currentWethConnectorBalance = await weth.balanceOf(connector.address)
            expect(currentWethConnectorBalance).to.be.equal(previousWethConnectorBalance)
          })
        } else {
          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(
                  destinationChainId,
                  WETH,
                  amount,
                  minAmountOut,
                  whale.address,
                  HOP_ETH_BRIDGE,
                  0,
                  ZERO_ADDRESS,
                  0
                )
            ).to.be.revertedWith('HopBridgeSameChain')
          })
        }
      }

      context('bridge to optimism', () => {
        const destinationChainId = 10

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to polygon', () => {
        const destinationChainId = 137

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to gnosis', () => {
        const destinationChainId = 100

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to arbitrum', () => {
        const destinationChainId = 42161

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to mainnet', () => {
        const destinationChainId = 1

        it('reverts', async () => {
          await expect(
            connector
              .connect(whale)
              .execute(destinationChainId, WETH, 0, 0, whale.address, HOP_ETH_BRIDGE, 0, ZERO_ADDRESS, 0)
          ).to.be.revertedWith('HopBridgeSameChain')
        })
      })

      context('bridge to goerli', () => {
        const destinationChainId = 5

        it('reverts', async () => {
          await expect(
            connector
              .connect(whale)
              .execute(destinationChainId, WETH, 0, 0, whale.address, HOP_ETH_BRIDGE, 0, ZERO_ADDRESS, 0)
          ).to.be.revertedWith('HopBridgeOpNotSupported')
        })
      })
    })

    context('when the recipient is the zero address', async () => {
      it('reverts', async function () {
        await expect(
          connector.connect(whale).execute(0, WETH, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, 0, ZERO_ADDRESS, 0)
        ).to.be.revertedWith('HopBridgeRecipientZero')
      })
    })
  })

  context('USDC', () => {
    const HOP_USDC_BRIDGE = '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a'

    context('when the recipient is not the zero address', async () => {
      function bridgesToL2Properly(destinationChainId: number) {
        const slippage = fp(0.03)
        const deadline = MAX_UINT256
        const amount = toUSDC(300)
        const minAmountOut = amount.sub(amount.mul(slippage).div(fp(1)))
        const relayer = ZERO_ADDRESS
        const relayerFee = 0

        if (destinationChainId != SOURCE_CHAIN_ID) {
          it('should send the tokens to the bridge', async () => {
            const previousSenderBalance = await usdc.balanceOf(whale.address)
            const previousBridgeBalance = await usdc.balanceOf(HOP_USDC_BRIDGE)
            const previousConnectorBalance = await usdc.balanceOf(connector.address)

            await usdc.connect(whale).transfer(connector.address, amount)
            await connector
              .connect(whale)
              .execute(
                destinationChainId,
                USDC,
                amount,
                minAmountOut,
                whale.address,
                HOP_USDC_BRIDGE,
                deadline,
                relayer,
                relayerFee
              )

            const currentSenderBalance = await usdc.balanceOf(whale.address)
            expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(amount))

            const currentBridgeBalance = await usdc.balanceOf(HOP_USDC_BRIDGE)
            expect(currentBridgeBalance).to.be.equal(previousBridgeBalance.add(amount))

            const currentConnectorBalance = await usdc.balanceOf(connector.address)
            expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
          })
        } else {
          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(
                  destinationChainId,
                  WETH,
                  amount,
                  minAmountOut,
                  whale.address,
                  HOP_USDC_BRIDGE,
                  0,
                  ZERO_ADDRESS,
                  0
                )
            ).to.be.revertedWith('HopBridgeSameChain')
          })
        }
      }

      context('bridge to optimism', () => {
        const destinationChainId = 10

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to polygon', () => {
        const destinationChainId = 137

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to gnosis', () => {
        const destinationChainId = 100

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to arbitrum', () => {
        const destinationChainId = 42161

        bridgesToL2Properly(destinationChainId)
      })

      context('bridge to mainnet', () => {
        const destinationChainId = 1

        it('reverts', async () => {
          await expect(
            connector.execute(destinationChainId, USDC, 0, 0, whale.address, HOP_USDC_BRIDGE, 0, ZERO_ADDRESS, 0)
          ).to.be.revertedWith('HopBridgeSameChain')
        })
      })

      context('bridge to goerli', () => {
        const destinationChainId = 5

        it('reverts', async () => {
          await expect(
            connector.execute(destinationChainId, USDC, 0, 0, whale.address, HOP_USDC_BRIDGE, 0, ZERO_ADDRESS, 0)
          ).to.be.revertedWith('HopBridgeOpNotSupported')
        })
      })
    })

    context('when the recipient is the zero address', async () => {
      it('reverts', async function () {
        await expect(
          connector.connect(whale).execute(0, USDC, 0, 0, ZERO_ADDRESS, HOP_USDC_BRIDGE, 0, ZERO_ADDRESS, 0)
        ).to.be.revertedWith('HopBridgeRecipientZero')
      })
    })
  })
})
