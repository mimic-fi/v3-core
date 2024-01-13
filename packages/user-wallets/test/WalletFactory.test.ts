import {
  assertAlmostEqual,
  assertEvent,
  deploy,
  deployTokenMock,
  fp,
  getSigners,
  instanceAt,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumberish, Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('WalletFactory', () => {
  let walletFactory: Contract
  let sender: SignerWithAddress, mimic: SignerWithAddress

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, sender, mimic] = await getSigners()
  })

  beforeEach('create wallet factory', async () => {
    walletFactory = await deploy('WalletFactory', [])
  })

  beforeEach('set sender', () => {
    walletFactory = walletFactory.connect(sender)
  })

  describe('deployWallet', () => {
    let wallet: Contract

    const WALLET_OWNER = '0x0000000000000000000000000000000000000001'
    const name = 'wallet'

    beforeEach('create wallet implementation', async () => {
      wallet = await deploy('Wallet', [WALLET_OWNER])
    })

    context('when the implementation is not zero', () => {
      const itDeploysWalletInstance = () => {
        it('deploys the expected wallet instance', async () => {
          const tx = await walletFactory.deployWallet(name, wallet.address)
          const event = await assertEvent(tx, 'WalletDeployed', { name, implementation: wallet.address })

          const expectedAddress = await walletFactory.getAddress(tx.from, name)
          expect(event.args.instance).to.be.equal(expectedAddress)
        })

        it('initializes the wallet instance correctly', async () => {
          const tx = await walletFactory.deployWallet(name, wallet.address)

          const instance = await instanceAt('Wallet', await walletFactory.getAddress(tx.from, name))

          expect(await instance.walletOwner()).to.be.equal(WALLET_OWNER)
        })
      }

      context('when the name was not used', () => {
        itDeploysWalletInstance()
      })

      context('when the name was already used', () => {
        beforeEach('deploy wallet', async () => {
          await walletFactory.deployWallet(name, wallet.address)
        })

        context('when deploying from the same address', () => {
          it('reverts', async () => {
            await expect(walletFactory.deployWallet(name, wallet.address)).to.be.revertedWith('DEPLOYMENT_FAILED')
          })
        })

        context('when deploying from another address', () => {
          beforeEach('set sender', () => {
            walletFactory = walletFactory.connect(mimic)
          })

          itDeploysWalletInstance()
        })
      })
    })

    context('when the implementation is zero', () => {
      const walletAddr = ZERO_ADDRESS

      it('reverts', async () => {
        await expect(walletFactory.deployWallet(name, walletAddr)).to.be.revertedWith('WalletFactoryImplementationZero')
      })
    })
  })

  describe('deployWalletCreate2', () => {
    let wallet: Contract

    const WALLET_OWNER = '0x0000000000000000000000000000000000000001'
    const name = 'wallet'

    beforeEach('create wallet implementation', async () => {
      wallet = await deploy('Wallet', [WALLET_OWNER])
    })

    context('when the implementation is not zero', () => {
      const itDeploysWalletInstance = () => {
        it('deploys the expected wallet instance', async () => {
          const tx = await walletFactory.deployWalletCreate2(name, wallet.address)
          const event = await assertEvent(tx, 'WalletDeployed', { name, implementation: wallet.address })

          const expectedAddress = await walletFactory.getAddressCreate2(tx.from, name, wallet.address)
          expect(event.args.instance).to.be.equal(expectedAddress)
        })

        it('initializes the wallet instance correctly', async () => {
          const tx = await walletFactory.deployWalletCreate2(name, wallet.address)

          const instance = await instanceAt(
            'Wallet',
            await walletFactory.getAddressCreate2(tx.from, name, wallet.address)
          )

          expect(await instance.walletOwner()).to.be.equal(WALLET_OWNER)
        })
      }

      context('when the name was not used', () => {
        itDeploysWalletInstance()
      })

      context('when the name was already used', () => {
        beforeEach('deploy wallet', async () => {
          await walletFactory.deployWalletCreate2(name, wallet.address)
        })

        context('when deploying from the same address', () => {
          it('reverts', async () => {
            await expect(walletFactory.deployWalletCreate2(name, wallet.address)).to.be.revertedWith(
              'Create2: Failed on deploy'
            )
          })
        })

        context('when deploying from another address', () => {
          beforeEach('set sender', () => {
            walletFactory = walletFactory.connect(mimic)
          })

          itDeploysWalletInstance()
        })
      })
    })

    context('when the implementation is zero', () => {
      const walletAddr = ZERO_ADDRESS

      it('reverts', async () => {
        await expect(walletFactory.deployWalletCreate2(name, walletAddr)).to.be.revertedWith(
          'WalletFactoryImplementationZero'
        )
      })
    })
  })

  describe('transfer gas', () => {
    let walletImpl: Contract, walletOwner: Contract, walletInstance: Contract
    let owner: SignerWithAddress

    before('setup signers', async () => {
      // eslint-disable-next-line prettier/prettier
      [, owner] = await getSigners()
    })

    beforeEach('create wallet factory, wallet and wallet owner', async () => {
      walletOwner = await deploy('WalletOwner', [owner.address])
      walletImpl = await deploy('Wallet', [walletOwner.address])
    })

    beforeEach('create wallet instance', async () => {
      const name = 'wallet'
      const tx = await walletFactory.deployWallet(name, walletImpl.address)
      walletInstance = await instanceAt('Wallet', await walletFactory.getAddress(tx.from, name))
    })

    context('when the token is an ERC20', () => {
      let token: Contract

      beforeEach('set token', async () => {
        token = await deployTokenMock('USDC')
      })

      const amountToFund = fp(5)

      beforeEach('fund wallet', async () => {
        await token.mint(walletInstance.address, amountToFund)
      })

      const itSendsTheAmountToTheOwner = (amount: BigNumberish) => {
        it('sends the amount to the owner', async () => {
          const previousWalletBalance = await token.balanceOf(walletInstance.address)
          const previousOwnerBalance = await token.balanceOf(owner.address)

          const data = walletImpl.interface.encodeFunctionData('transfer', [token.address, amount])
          const tx = await owner.sendTransaction({ to: walletInstance.address, data })
          const { gasUsed } = await tx.wait()
          console.log(`Gas units used: ${gasUsed.toString()}`)

          const currentWalletBalance = await token.balanceOf(walletInstance.address)
          expect(currentWalletBalance).to.be.equal(previousWalletBalance.sub(amount))

          const currentOwnerBalance = await token.balanceOf(owner.address)
          expect(currentOwnerBalance).to.be.equal(previousOwnerBalance.add(amount))
        })
      }

      context('when the owner balance before is zero', () => {
        context('when the wallet sends all its balance', () => {
          const amount = amountToFund

          itSendsTheAmountToTheOwner(amount)
        })

        context('when the wallet sends some balance', () => {
          const amount = amountToFund.div(4)

          itSendsTheAmountToTheOwner(amount)
        })
      })

      context('when the owner balance before is greater than zero', () => {
        beforeEach('fund owner', async () => {
          await token.mint(owner.address, amountToFund)
        })

        context('when the wallet sends all its balance', () => {
          const amount = amountToFund

          itSendsTheAmountToTheOwner(amount)
        })

        context('when the wallet sends some balance', () => {
          const amount = amountToFund.div(4)

          itSendsTheAmountToTheOwner(amount)
        })
      })
    })

    context('when the token is the native token', () => {
      const token = NATIVE_TOKEN_ADDRESS
      const amountToFund = fp(2)

      beforeEach('fund wallet', async () => {
        await owner.sendTransaction({ to: walletInstance.address, value: amountToFund })
      })

      const itSendsTheAmountToTheOwner = (amount: BigNumberish) => {
        it('sends the amount to the owner', async () => {
          const previousWalletBalance = await ethers.provider.getBalance(walletInstance.address)
          const previousOwnerBalance = await ethers.provider.getBalance(owner.address)

          const data = walletImpl.interface.encodeFunctionData('transfer', [token, amount])
          const tx = await owner.sendTransaction({ to: walletInstance.address, data })
          const { gasUsed } = await tx.wait()
          console.log(`Gas units used: ${gasUsed.toString()}`)

          const currentWalletBalance = await ethers.provider.getBalance(walletInstance.address)
          expect(currentWalletBalance).to.be.equal(previousWalletBalance.sub(amount))

          const currentOwnerBalance = await ethers.provider.getBalance(owner.address)
          assertAlmostEqual(previousOwnerBalance.add(amount), currentOwnerBalance, 0.0005)
        })
      }

      context('when the wallet sends all its balance', () => {
        const amount = amountToFund

        itSendsTheAmountToTheOwner(amount)
      })

      context('when the wallet sends some balance', () => {
        const amount = amountToFund.div(4)

        itSendsTheAmountToTheOwner(amount)
      })
    })
  })
})
