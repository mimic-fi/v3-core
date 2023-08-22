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

const MORPHO = '0x777777c9898D384F785Ee44Acfe945efDFf5f3E0'
const REWARDS_DISTRIBUTOR = '0x3B14E5C73e0A56D607A8688098326fD4b4292135'
const LENS = '0x507fA343d0A90786d86C7cd885f5C49263A91FF4'

const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

describe('MorphoAaveV2Connector', function () {
  let whale: SignerWithAddress
  let connector: Contract, lens: Contract, usdc: Contract

  const SUPPLY_AMOUNT = toUSDC(50)

  before('impersonate whale', async () => {
    whale = await impersonate(WHALE, fp(100))
  })

  before('deploy connector', async () => {
    connector = await deploy('MorphoAaveV2Connector', [MORPHO, LENS, REWARDS_DISTRIBUTOR])
    lens = await instanceAt('ILens', LENS)
    usdc = await instanceAt('IERC20', USDC)
  })

  it('deploys the connector correctly', async () => {
    expect(await connector.morpho()).to.be.equal(MORPHO)
  })

  async function supplyBalance() {
    const [, , totalBalance] = await lens.getCurrentSupplyBalanceInOf(AUSDC, connector.address)
    return totalBalance
  }

  it('supplies liquidity', async () => {
    await usdc.connect(whale).transfer(connector.address, SUPPLY_AMOUNT)

    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousSupplyBalance = await supplyBalance()

    await connector.connect(whale).join(USDC, SUPPLY_AMOUNT)

    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    expect(currentUsdcBalance).to.be.equal(previousUsdcBalance.sub(SUPPLY_AMOUNT))

    const currentSupplyBalance = await supplyBalance()
    expect(currentSupplyBalance).to.be.equal(previousSupplyBalance.add(SUPPLY_AMOUNT))
  })

  it('accumulates yield over time', async () => {
    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousSupplyBalance = await supplyBalance()

    await advanceTime(MONTH)

    const currentSupplyBalance = await supplyBalance()

    const earnings = currentSupplyBalance.sub(previousSupplyBalance)
    expect(earnings).to.be.gt(0)

    await connector.exit(USDC, earnings)

    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    expect(currentUsdcBalance).to.be.equal(previousUsdcBalance.add(earnings))
  })

  it('exits with a 50%', async () => {
    const previousUsdcBalance = await usdc.balanceOf(connector.address)
    const previousSupplyBalance = await supplyBalance()

    const toWithdraw = previousSupplyBalance.div(2)
    await connector.exit(USDC, toWithdraw)

    const currentUsdcBalance = await usdc.balanceOf(connector.address)
    expect(currentUsdcBalance).to.be.equal(previousUsdcBalance.add(toWithdraw))

    const currentSupplyBalance = await supplyBalance()
    assertAlmostEqual(currentSupplyBalance, previousSupplyBalance.sub(toWithdraw), 0.0005)
  })
})
