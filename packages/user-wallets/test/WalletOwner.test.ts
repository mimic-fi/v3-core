import { deploy, getSigners } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('WalletOwner', () => {
  let walletOwner: Contract
  let owner: SignerWithAddress

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner] = await getSigners()
  })

  beforeEach('create wallet owner', async () => {
    walletOwner = await deploy('WalletOwner', [owner.address])
  })

  describe('owner', () => {
    it('sets the owner properly', async () => {
      expect(await walletOwner.owner()).to.be.equal(owner.address)
    })
  })
})
