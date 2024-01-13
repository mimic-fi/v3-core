import {
  assertAlmostEqual,
  assertEvent,
  deploy,
  deployTokenMock,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('Wallet', () => {
  let wallet: Contract, walletOwner: Contract
  let owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner] = await getSigners()
  })

  beforeEach('deploy wallet and wallet owner', async () => {
    walletOwner = await deploy('WalletOwner', [owner.address])
    wallet = await deploy('Wallet', [walletOwner.address])
  })

  describe('walletOwner', () => {
    it('sets the wallet owner properly', async () => {
      expect(await wallet.walletOwner()).to.be.equal(walletOwner.address)
    })
  })

  describe('receive', () => {
    const value = 1

    it('accepts native tokens', async () => {
      await owner.sendTransaction({ to: wallet.address, value })

      expect(await ethers.provider.getBalance(wallet.address)).to.be.equal(value)
    })
  })

  describe('transfer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        wallet = wallet.connect(owner)
      })

      context('when the token is not zero', () => {
        context('when the token is an ERC20', () => {
          let token: Contract

          beforeEach('set token', async () => {
            token = await deployTokenMock('USDC')
          })

          context('when the amount is not zero', () => {
            const amount = fp(5)

            beforeEach('fund wallet', async () => {
              await token.mint(wallet.address, amount)
            })

            it('sends the amount to the owner', async () => {
              const previousWalletBalance = await token.balanceOf(wallet.address)
              const previousOwnerBalance = await token.balanceOf(owner.address)

              await wallet.transfer(token.address, amount)

              const currentWalletBalance = await token.balanceOf(wallet.address)
              expect(currentWalletBalance).to.be.equal(previousWalletBalance.sub(amount))

              const currentOwnerBalance = await token.balanceOf(owner.address)
              expect(currentOwnerBalance).to.be.equal(previousOwnerBalance.add(amount))
            })

            it('emits an event', async () => {
              const tx = await wallet.transfer(token.address, amount)

              await assertEvent(tx, 'Transferred')
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(wallet.transfer(token.address, amount)).to.be.revertedWith('WalletAmountZero')
            })
          })
        })

        context('when the token is the native token', () => {
          const token = NATIVE_TOKEN_ADDRESS

          context('when the amount is not zero', () => {
            const amount = fp(2)

            beforeEach('fund wallet', async () => {
              await owner.sendTransaction({ to: wallet.address, value: amount })
            })

            it('sends the amount to the owner', async () => {
              const previousWalletBalance = await ethers.provider.getBalance(wallet.address)
              const previousOwnerBalance = await ethers.provider.getBalance(owner.address)

              await wallet.transfer(token, amount)

              const currentWalletBalance = await ethers.provider.getBalance(wallet.address)
              expect(currentWalletBalance).to.be.equal(previousWalletBalance.sub(amount))

              const currentOwnerBalance = await ethers.provider.getBalance(owner.address)
              assertAlmostEqual(previousOwnerBalance.add(amount), currentOwnerBalance, 0.0005)
            })

            it('emits an event', async () => {
              const tx = await wallet.transfer(token, amount)

              await assertEvent(tx, 'Transferred')
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(wallet.transfer(token, amount)).to.be.revertedWith('WalletAmountZero')
            })
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(wallet.transfer(token, 1)).to.be.revertedWith('WalletTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(wallet.transfer(ZERO_ADDRESS, 0)).to.be.revertedWith('WalletUnauthorizedSender')
      })
    })
  })
})
