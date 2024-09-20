import { advanceTime, deploy, fp, impersonate, instanceAt, MONTH, toUSDC } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const CRV = '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978'
const CURVE_POOL = '0x7f90122BF0700F9E7e1F688fe926940E8839F353'
const CVX_POOL = '0x971E732B5c91A59AEa8aa5B0c763E6d648362CF8'
const BOOSTER = '0xF403C135812408BFbE8713b5A23a04b3D48AAE31'

const WHALE = '0xf403c135812408bfbe8713b5a23a04b3d48aae31'

describe('ConvexConnector - 2CRV', function () {
  let whale: SignerWithAddress
  let connector: Contract, pool: Contract, cvxPool: Contract, crv: Contract

  const JOIN_AMOUNT = toUSDC(100)

  before('impersonate whale', async () => {
    whale = await impersonate(WHALE, fp(10))
  })

  before('deploy connector', async () => {
    connector = await deploy('ConvexConnector', [BOOSTER])
    crv = await instanceAt('IERC20', CRV)
    pool = await instanceAt('I2CrvPool', CURVE_POOL)
    cvxPool = await instanceAt('ICvxPool', CVX_POOL)
  })

  it('deploys the connector correctly', async () => {
    expect(await connector.booster()).to.be.equal(BOOSTER)
  })

  it('joins the connector', async () => {
    await pool.connect(whale).transfer(connector.address, JOIN_AMOUNT)

    const previousPoolBalance = await pool.balanceOf(connector.address)
    const previousCvxPoolBalance = await cvxPool.balanceOf(connector.address)

    await connector.join(CURVE_POOL, JOIN_AMOUNT)

    const currentPoolBalance = await pool.balanceOf(connector.address)
    expect(currentPoolBalance).to.be.equal(previousPoolBalance.sub(JOIN_AMOUNT))

    const currentCvxPoolBalance = await cvxPool.balanceOf(connector.address)
    expect(currentCvxPoolBalance).to.be.equal(previousCvxPoolBalance.add(JOIN_AMOUNT))
  })

  it('accrues rewards over time', async () => {
    const previousCrvBalance = await crv.balanceOf(connector.address)

    await advanceTime(MONTH)
    await connector.claim(CVX_POOL)

    const currentCrvBalance = await crv.balanceOf(connector.address)
    expect(currentCrvBalance).to.be.gt(previousCrvBalance)
  })

  it('exits with a 50%', async () => {
    const previousPoolBalance = await pool.balanceOf(connector.address)
    const previousCvxPoolBalance = await cvxPool.balanceOf(connector.address)

    const amountIn = previousCvxPoolBalance.div(2)
    await connector.exit(CVX_POOL, amountIn)

    const currentCvxPoolBalance = await cvxPool.balanceOf(connector.address)
    expect(currentCvxPoolBalance).to.be.equal(previousCvxPoolBalance.sub(amountIn))

    const currentPoolBalance = await pool.balanceOf(connector.address)
    expect(currentPoolBalance).to.be.equal(previousPoolBalance.add(amountIn))
  })
})
