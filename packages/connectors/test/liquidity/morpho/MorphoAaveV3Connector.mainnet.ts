import {
  advanceTime,
  assertAlmostEqual,
  deploy,
  fp,
  impersonate,
  instanceAt,
  MONTH,
  toUSDC,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
// const MORPHO_TOKEN = '0x9994E35Db50125E0DF82e4c2dde62496CE330999'

const MORPHO = '0x33333aea097c193e66081E930c33020272b33333'
const REWARDS_DISTRIBUTOR = '0x3B14E5C73e0A56D607A8688098326fD4b4292135'

const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

describe('MorphoAaveV3Connector', function () {
  let whale: SignerWithAddress
  let connector: Contract, weth: Contract

  const SUPPLY_AMOUNT = toUSDC(100)
  const maxIterations = 4

  before('impersonate whale', async () => {
    whale = await impersonate(WHALE, fp(10))
  })

  before('deploy connector', async () => {
    connector = await deploy('MorphoAaveV3Connector', [MORPHO, REWARDS_DISTRIBUTOR])
    weth = await instanceAt('IERC20', WETH)
  })

  it('deploys the connector correctly', async () => {
    expect(await connector.morpho()).to.be.equal(MORPHO)
  })

  it('supplies liquidity', async () => {
    await weth.connect(whale).transfer(connector.address, SUPPLY_AMOUNT)

    const previousWethBalance = await weth.balanceOf(connector.address)
    const previousSupplyBalance = await connector.supplyBalance(WETH)

    await connector.connect(whale).supply(WETH, SUPPLY_AMOUNT, maxIterations)

    const currentWethBalance = await weth.balanceOf(connector.address)
    expect(currentWethBalance).to.be.equal(previousWethBalance.sub(SUPPLY_AMOUNT))

    const currentSupplyBalance = await connector.supplyBalance(WETH)
    expect(currentSupplyBalance).to.be.equal(previousSupplyBalance.add(SUPPLY_AMOUNT))
  })

  it('accumulates yield over time', async () => {
    const previousWethBalance = await weth.balanceOf(connector.address)
    const previousSupplyBalance = await connector.supplyBalance(WETH)

    await advanceTime(MONTH)

    const currentSupplyBalance = await connector.supplyBalance(WETH)

    const earnings = currentSupplyBalance.sub(previousSupplyBalance)
    expect(earnings).to.be.gt(0)

    await connector.withdraw(WETH, earnings, maxIterations)

    const currentWethBalance = await weth.balanceOf(connector.address)
    expect(currentWethBalance).to.be.equal(previousWethBalance.add(earnings))
  })

  it('exits with a 50%', async () => {
    const previousWethBalance = await weth.balanceOf(connector.address)
    const previousSupplyBalance = await connector.supplyBalance(WETH)

    const toWithdraw = previousSupplyBalance.div(2)
    await connector.withdraw(WETH, toWithdraw, maxIterations)

    const currentWethBalance = await weth.balanceOf(connector.address)
    expect(currentWethBalance).to.be.equal(previousWethBalance.add(toWithdraw))

    const currentSupplyBalance = await connector.supplyBalance(WETH)
    assertAlmostEqual(currentSupplyBalance, previousSupplyBalance.sub(toWithdraw), 0.0005)
  })

  it('claims morpho rewards', async () => {
    // TODO: test rewards
    expect(true).to.be.false
  })
})
