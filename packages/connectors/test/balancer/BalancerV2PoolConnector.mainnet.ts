import { BigNumberish, deploy, fp, impersonate, instanceAt, tokens, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'

describe('BalancerV2PoolConnector', function () {
  let connector: Contract, pool: Contract, whale: SignerWithAddress

  before('deploy connector', async () => {
    connector = await deploy('BalancerV2PoolConnector', [BALANCER_VAULT])
  })

  function itHandlesPoolsLiquidityProperly(
    poolId: string,
    joinTokenAddress: string,
    joinAmount: BigNumberish,
    whaleAddress: string
  ) {
    before('load pool and tokens', async () => {
      pool = await instanceAt('IBalancerPool', poolId.slice(0, 42))
      whale = await impersonate(whaleAddress, fp(10))
    })

    describe('join', () => {
      context('when the given token in belongs to the pool', () => {
        const tokenIn = joinTokenAddress

        context('when the min amount out is enough', () => {
          const minAmountOut = 0

          it('joins the pool', async () => {
            const token = await instanceAt('IERC20', tokenIn)
            await token.connect(whale).transfer(connector.address, joinAmount)

            const previousPoolBalance = await pool.balanceOf(connector.address)
            const previousTokenBalance = await token.balanceOf(connector.address)

            await connector.join(poolId, token.address, joinAmount, minAmountOut)

            const currentTokenBalance = await token.balanceOf(connector.address)
            expect(currentTokenBalance).to.be.equal(previousTokenBalance.sub(joinAmount))

            const currentPoolBalance = await pool.balanceOf(connector.address)
            expect(currentPoolBalance).to.be.gt(previousPoolBalance)
          })
        })

        context('when the min amount out is not enough', () => {
          const minAmountOut = fp(2000)

          it('reverts', async () => {
            await expect(connector.join(poolId, tokenIn, joinAmount, minAmountOut)).to.be.revertedWith('BAL#208')
          })
        })
      })

      context('when the given token in do not belong to the pool', () => {
        const tokenIn = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(connector.join(poolId, tokenIn, 0, 0)).to.be.revertedWith('BalancerV2InvalidToken')
        })
      })
    })

    describe('exit', () => {
      context('when the given tokens out and min amounts out lengths match', () => {
        let tokensOut: string[]
        let minAmountsOut: BigNumberish[]

        beforeEach('set tokens out', async () => {
          const balancer = await instanceAt('IBalancerV2Vault', BALANCER_VAULT)
          const poolData = await balancer.getPoolTokens(await pool.getPoolId())
          tokensOut = poolData.tokens
          minAmountsOut = tokensOut.map(() => 0)
        })

        context('when the given tokens out matches the pool tokens', () => {
          it('exits the pool proportionally', async () => {
            const previousPoolBalance = await pool.balanceOf(connector.address)
            const previousTokenOutBalances = await Promise.all(
              tokensOut.map(async (tokenAddress) => {
                const tokenOut = await instanceAt('IERC20', tokenAddress)
                return tokenOut.balanceOf(connector.address)
              })
            )

            const amountIn = previousPoolBalance.div(2)
            await connector.exit(pool.address, amountIn, tokensOut, minAmountsOut)

            const currentPoolBalance = await pool.balanceOf(connector.address)
            expect(currentPoolBalance).to.be.equal(previousPoolBalance.sub(amountIn))

            for (const tokenAddress of tokensOut) {
              const index = tokensOut.indexOf(tokenAddress)
              const tokenOut = await instanceAt('IERC20', tokenAddress)
              expect(await tokenOut.balanceOf(connector.address)).to.be.gt(previousTokenOutBalances[index])
            }
          })
        })

        context('when the given tokens out do not match the pool tokens', () => {
          context('when the given tokens out are in a different order', () => {
            beforeEach('reverse tokens out', async () => {
              tokensOut = Array.from(tokensOut).reverse()
            })

            it('reverts', async () => {
              await expect(connector.exit(pool.address, 0, tokensOut, minAmountsOut)).to.be.revertedWith(
                'BalancerV2InvalidToken'
              )
            })
          })

          context('when the given tokens out are incomplete', () => {
            beforeEach('remove one tokens out', async () => {
              tokensOut = [tokensOut[0]]
              minAmountsOut = [minAmountsOut[0]]
            })

            it('reverts', async () => {
              await expect(connector.exit(pool.address, 0, tokensOut, minAmountsOut)).to.be.revertedWith(
                'BalancerV2InvalidTokensOutLength'
              )
            })
          })
        })
      })

      context('when the given tokens out and min amounts out lengths do not match', () => {
        const tokensOut = [ZERO_ADDRESS]
        const minAmountsOut = []

        it('reverts', async () => {
          await expect(connector.exit(pool.address, 0, tokensOut, minAmountsOut)).to.be.revertedWith(
            'BalancerV2InvalidInputLength'
          )
        })
      })
    })
  }

  context('weighted pool', () => {
    const POOL_ID = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014' // BAL-WETH 80/20
    const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

    itHandlesPoolsLiquidityProperly(POOL_ID, tokens.mainnet.WETH, fp(5), WHALE)
  })

  context('stable pool', () => {
    const POOL_ID = '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063' // staBAL3
    const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

    itHandlesPoolsLiquidityProperly(POOL_ID, tokens.mainnet.USDC, toUSDC(500), WHALE)
  })
})
