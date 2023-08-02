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

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const AUSDC = '0xBcca60bB61934080951369a648Fb03DF4F96263C'
// const MORPHO_TOKEN = '0x9994E35Db50125E0DF82e4c2dde62496CE330999'

const MORPHO = '0x777777c9898D384F785Ee44Acfe945efDFf5f3E0'
const REWARDS_DISTRIBUTOR = '0x3B14E5C73e0A56D607A8688098326fD4b4292135'
const LENS = '0x507fA343d0A90786d86C7cd885f5C49263A91FF4'

const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

describe('MorphoAaveV2Connector', function () {
  let whale: SignerWithAddress
  let connector: Contract, usdc: Contract

  const SUPPLY_AMOUNT = toUSDC(50)

  before('impersonate whale', async () => {
    whale = await impersonate(WHALE, fp(100))
  })

  before('deploy connector', async () => {
    connector = await deploy('MorphoAaveV2Connector', [MORPHO, LENS, REWARDS_DISTRIBUTOR])
    usdc = await instanceAt('IERC20', USDC)
  })

  it('deploys the connector correctly', async () => {
    expect(await connector.morpho()).to.be.equal(MORPHO)
  })

  it('supplies liquidity', async () => {
    await usdc.connect(whale).transfer(connector.address, SUPPLY_AMOUNT)

    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousSupplyBalance = await connector.supplyBalance(AUSDC)

    await connector.connect(whale).supply(AUSDC, USDC, SUPPLY_AMOUNT)

    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    expect(currentUsdcBalance).to.be.equal(previousUsdcBalance.sub(SUPPLY_AMOUNT))

    const currentSupplyBalance = await connector.supplyBalance(AUSDC)
    expect(currentSupplyBalance).to.be.equal(previousSupplyBalance.add(SUPPLY_AMOUNT))
  })

  it('accumulates yield over time', async () => {
    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousSupplyBalance = await connector.supplyBalance(AUSDC)

    await advanceTime(MONTH)

    const currentSupplyBalance = await connector.supplyBalance(AUSDC)

    const earnings = currentSupplyBalance.sub(previousSupplyBalance)
    expect(earnings).to.be.gt(0)

    await connector.withdraw(AUSDC, earnings)

    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    expect(currentUsdcBalance).to.be.equal(previousUsdcBalance.add(earnings))
  })

  it('exits with a 50%', async () => {
    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousSupplyBalance = await connector.supplyBalance(AUSDC)

    const toWithdraw = previousSupplyBalance.div(2)
    await connector.withdraw(AUSDC, toWithdraw)

    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    expect(currentUsdcBalance).to.be.equal(previousUsdcBalance.add(toWithdraw))

    const currentSupplyBalance = await connector.supplyBalance(AUSDC)
    assertAlmostEqual(currentSupplyBalance, previousSupplyBalance.sub(toWithdraw), 0.0005)
  })

  it('claims morpho rewards', async () => {
    // TODO: test rewards
    expect(true).to.be.false
  })
})
