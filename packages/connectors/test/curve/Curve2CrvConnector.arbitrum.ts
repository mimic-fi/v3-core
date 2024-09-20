import { assertAlmostEqual, deploy, fp, impersonate, instanceAt, toUSDC } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const USDCe = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
const POOL = '0x7f90122BF0700F9E7e1F688fe926940E8839F353'

const WHALE = '0x62383739d68dd0f844103db8dfb05a7eded5bbe6'

describe('Curve2CrvConnector - USDCe', function () {
  let whale: SignerWithAddress
  let connector: Contract, pool: Contract, usdc: Contract

  const SLIPPAGE = fp(0.001)
  const JOIN_AMOUNT = toUSDC(100)

  before('impersonate whale', async () => {
    whale = await impersonate(WHALE, fp(10))
  })

  before('deploy connector', async () => {
    connector = await deploy('Curve2CrvConnector')
    usdc = await instanceAt('IERC20', USDCe)
    pool = await instanceAt('I2CrvPool', POOL)
  })

  it('joins curve', async () => {
    await usdc.connect(whale).transfer(connector.address, JOIN_AMOUNT)

    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousPoolBalance = await pool.balanceOf(connector.address)

    await connector.join(POOL, USDCe, JOIN_AMOUNT, SLIPPAGE)

    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    expect(currentUsdcBalance).to.be.equal(previousUsdcBalance.sub(JOIN_AMOUNT))

    const poolTokenPrice = await pool.get_virtual_price()
    const currentPoolBalance = await pool.balanceOf(connector.address)
    const expectedPoolAmount = JOIN_AMOUNT.mul(1e12).mul(fp(1)).div(poolTokenPrice)
    assertAlmostEqual(expectedPoolAmount, currentPoolBalance.sub(previousPoolBalance), 0.0005)
  })

  it('exits with a 50%', async () => {
    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousPoolBalance = await pool.balanceOf(connector.address)

    const amountIn = previousPoolBalance.div(2)
    await connector.exit(POOL, amountIn, USDCe, SLIPPAGE)

    const currentPoolBalance = await pool.balanceOf(connector.address)
    expect(currentPoolBalance).to.be.equal(previousPoolBalance.sub(amountIn))

    const poolTokenPrice = await pool.get_virtual_price()
    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    const expectedUsdcBalance = amountIn.mul(poolTokenPrice).div(fp(1)).div(1e12)
    assertAlmostEqual(expectedUsdcBalance, currentUsdcBalance.sub(previousUsdcBalance), 0.0005)
  })
})
