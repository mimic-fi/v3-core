import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS } from '../../../src/constants'
import { deploy } from '../../../src/contracts'
import { deployTokenMock } from '../../../src/mocks'
import { getSigner } from '../../../src/signers'

describe('ERC20Helpers', () => {
  let library: Contract, someone: string

  beforeEach('deploy lib', async () => {
    someone = (await getSigner(1)).address
    library = await deploy('ERC20HelpersMock')
  })

  describe('balanceOf', () => {
    context('when the token is the native token', () => {
      const token = NATIVE_TOKEN_ADDRESS

      it('returns the account balance correctly', async () => {
        expect(await library.balanceOf(token, ZERO_ADDRESS)).to.be.eq(0)
        expect(await library.balanceOf(token, someone)).to.be.equal(await ethers.provider.getBalance(someone))
      })
    })

    context('when the token is an ERC20 token', () => {
      let token: Contract

      beforeEach('deploy token', async () => {
        token = await deployTokenMock('TKN')
        await token.mint(someone, 10)
      })

      it('returns the account balance correctly', async () => {
        expect(await library.balanceOf(token.address, ZERO_ADDRESS)).to.be.eq(0)
        expect(await library.balanceOf(token.address, someone)).to.be.equal(10)
      })
    })
  })

  describe('transfer', () => {
    const amount = 10

    context('when the token is the native token', () => {
      const token = NATIVE_TOKEN_ADDRESS

      beforeEach('fund library', async () => {
        const signer = await getSigner()
        await signer.sendTransaction({ to: library.address, value: amount })
      })

      it('transfers value correctly', async () => {
        const previousLibraryBalance = await library.balanceOf(token, library.address)
        const previousRecipientBalance = await library.balanceOf(token, someone)

        await library.transfer(token, someone, amount)

        const currentLibraryBalance = await library.balanceOf(token, library.address)
        expect(currentLibraryBalance).to.be.equal(previousLibraryBalance.sub(amount))

        const currentRecipientBalance = await library.balanceOf(token, someone)
        expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount))
      })
    })

    context('when the token is an ERC20 token', () => {
      let token: Contract

      beforeEach('deploy token', async () => {
        token = await deployTokenMock('TKN')
      })

      beforeEach('fund library', async () => {
        await token.mint(library.address, amount)
      })

      it('transfers tokens correctly', async () => {
        const previousLibraryBalance = await library.balanceOf(token.address, library.address)
        const previousRecipientBalance = await library.balanceOf(token.address, someone)

        await library.transfer(token.address, someone, amount)

        const currentLibraryBalance = await library.balanceOf(token.address, library.address)
        expect(currentLibraryBalance).to.be.equal(previousLibraryBalance.sub(amount))

        const currentRecipientBalance = await library.balanceOf(token.address, someone)
        expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount))
      })
    })
  })

  describe('approve', () => {
    context('when the token is the native token', () => {
      const token = NATIVE_TOKEN_ADDRESS

      it('reverts', async () => {
        await expect(library.approve(token, someone, 10)).to.be.reverted
      })
    })

    context('when the token is an ERC20 token', () => {
      let token: Contract

      beforeEach('deploy token', async () => {
        token = await deployTokenMock('TKN')
      })

      it('updates allowance correctly', async () => {
        await library.approve(token.address, someone, 10)
        expect(await token.allowance(library.address, someone)).to.be.equal(10)

        await library.approve(token.address, someone, 20)
        expect(await token.allowance(library.address, someone)).to.be.equal(20)

        await library.approve(token.address, someone, 0)
        expect(await token.allowance(library.address, someone)).to.be.equal(0)
      })
    })
  })
})
