import { advanceTime, deploy, fp, impersonate, instanceAt, MONTH, ONES_ADDRESS, toUSDC } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'
const MORPHO_AAVE_V3_WETH = '0x39Dd7790e75C6F663731f7E1FdC0f35007D3879b'

describe('ERC4626AdapterConnector', function () {
  let whale: SignerWithAddress
  let connector: Contract, erc4626Adapter: Contract, weth: Contract

  const JOIN_AMOUNT = toUSDC(10)

  before('impersonate whale', async () => {
    whale = await impersonate(WHALE, fp(1000))
  })

  before('create ERC4626 adapter', async () => {
    const fee = fp(0.1)

    erc4626Adapter = await deploy('@mimic-fi/erc4626-adapter/artifacts/contracts/ERC4626Adapter.sol/ERC4626Adapter', [
      MORPHO_AAVE_V3_WETH,
      fee,
      ONES_ADDRESS,
      ONES_ADDRESS,
    ])
  })

  before('deploy connector', async () => {
    connector = await deploy('ERC4626AdapterConnector', [erc4626Adapter.address])
    weth = await instanceAt('IERC20', WETH)
  })

  it('deploys the connector correctly', async () => {
    expect(await connector.adapter()).to.be.equal(erc4626Adapter.address)
  })

  it('joins the connector', async () => {
    await weth.connect(whale).transfer(connector.address, JOIN_AMOUNT)

    const previousWethBalance = await weth.balanceOf(connector.address)
    const previousShares = await erc4626Adapter.balanceOf(connector.address)

    await connector.connect(whale).join(JOIN_AMOUNT)

    const currentWethBalance = await weth.balanceOf(connector.address)
    expect(currentWethBalance).to.be.equal(previousWethBalance.sub(JOIN_AMOUNT))

    const currentShares = await erc4626Adapter.balanceOf(connector.address)
    const joinShares = erc4626Adapter.convertToShares(JOIN_AMOUNT)
    expect(currentShares).to.be.equal(previousShares.add(joinShares))
  })

  it('accumulates yield over time', async () => {
    const previousShares = await erc4626Adapter.balanceOf(connector.address)
    const previousAssets = await erc4626Adapter.convertToAssets(previousShares)

    await advanceTime(MONTH)

    const currentShares = await erc4626Adapter.balanceOf(connector.address)
    const currentAssets = await erc4626Adapter.convertToAssets(currentShares)

    expect(currentShares).to.be.equal(previousShares)
    expect(currentAssets).to.be.gt(previousAssets)
  })

  it('exits with a 50%', async () => {
    const previousWethBalance = await weth.balanceOf(connector.address)
    const previousShares = await erc4626Adapter.balanceOf(connector.address)
    const previousAssets = await erc4626Adapter.convertToAssets(previousShares)

    const exitShares = previousShares.div(2)
    const exitAssets = previousAssets.div(2)
    await connector.exit(exitShares)

    const currentWethBalance = await weth.balanceOf(connector.address)
    expect(currentWethBalance).to.be.equal(previousWethBalance.add(exitAssets))

    const sharesAfterExit = await erc4626Adapter.balanceOf(connector.address)
    expect(sharesAfterExit).to.be.equal(previousShares.sub(exitShares))
  })
})
