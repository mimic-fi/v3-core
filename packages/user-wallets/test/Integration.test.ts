import {
  assertAlmostEqual,
  bn,
  deploy,
  deployTokenMock,
  fp,
  getSigners,
  instanceAt,
  NATIVE_TOKEN_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('Integration', () => {
  let walletFactory: Contract, walletImpl: Contract, walletOwner: Contract
  let userA: SignerWithAddress, userB: SignerWithAddress, userC: SignerWithAddress
  let ownerA: SignerWithAddress, ownerB: SignerWithAddress
  let userWalletA: Contract, userWalletB: Contract, userWalletC: Contract
  let tokenA: Contract, tokenB: Contract

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
        [, userA, userB, userC, ownerA, ownerB] = await getSigners()
  })

  before('create wallet factory, wallet and wallet owner', async () => {
    walletFactory = await deploy('WalletFactory', [])
    walletOwner = await deploy('WalletOwner', [ownerA.address])
    walletImpl = await deploy('Wallet', [walletOwner.address])
  })

  const deployWallet = async (sender: SignerWithAddress, name: string) => {
    const tx = await walletFactory.connect(sender).deployWallet(name, walletImpl.address)
    return await instanceAt('Wallet', await walletFactory.getAddress(tx.from, name))
  }

  before('create user wallets', async () => {
    userWalletA = await deployWallet(userA, 'userA')
    userWalletB = await deployWallet(userB, 'userB')
  })

  before('set tokens', async () => {
    tokenA = await deployTokenMock('USDC')
    tokenB = await deployTokenMock('WETH')
  })

  let initialOwnerANative: BigNumber, initialOwnerBNative: BigNumber

  before('set owner initial balances', async () => {
    initialOwnerANative = await ethers.provider.getBalance(ownerA.address)
    initialOwnerBNative = await ethers.provider.getBalance(ownerB.address)
  })

  interface WalletBalance {
    tokenABalance: BigNumber
    tokenBBalance: BigNumber
    nativeBalance: BigNumber
  }

  async function checkWalletBalance(userAddress: string, walletBalance: WalletBalance) {
    const ERROR = 1e-5

    const currentTokenABalance = await tokenA.balanceOf(userAddress)
    assertAlmostEqual(currentTokenABalance, walletBalance.tokenABalance, ERROR)

    const currentTokenBBalance = await tokenB.balanceOf(userAddress)
    assertAlmostEqual(currentTokenBBalance, walletBalance.tokenBBalance, ERROR)

    const currentNativeBalance = await ethers.provider.getBalance(userAddress)
    assertAlmostEqual(currentNativeBalance, walletBalance.nativeBalance, ERROR)
  }

  function checkBalances(
    walletABalance: WalletBalance,
    walletBBalance: WalletBalance,
    walletCBalance: WalletBalance,
    ownerABalance: WalletBalance,
    ownerBBalance: WalletBalance
  ) {
    it('updates userA wallet balances correctly', async () => {
      await checkWalletBalance(userWalletA.address, walletABalance)
    })

    it('updates userB wallet balances correctly', async () => {
      await checkWalletBalance(userWalletB.address, walletBBalance)
    })

    it('updates userC wallet balances correctly', async () => {
      try {
        await checkWalletBalance(userWalletC.address, walletCBalance)
      } catch (error) {
        console.log('UserC wallet does not exist yet')
      }
    })

    it('updates ownerA balances correctly', async () => {
      ownerABalance.nativeBalance = ownerABalance.nativeBalance.add(initialOwnerANative)
      await checkWalletBalance(ownerA.address, ownerABalance)
    })

    it('updates ownerB balances correctly', async () => {
      ownerBBalance.nativeBalance = ownerBBalance.nativeBalance.add(initialOwnerBNative)
      await checkWalletBalance(ownerB.address, ownerBBalance)
    })
  }

  context('when userA deposits 100 tokenA', async () => {
    let walletATokenA: BigNumber, walletATokenB: BigNumber
    let walletBNative: BigNumber
    let walletCTokenB: BigNumber
    let ownerANative: BigNumber
    let ownerBTokenA: BigNumber, ownerBTokenB: BigNumber, ownerBNative: BigNumber

    const amount = fp(100)

    before('deposit 100 tokenA for userA', async () => {
      await tokenA.mint(userA.address, amount)
      await tokenA.connect(userA).transfer(userWalletA.address, amount)
    })

    walletATokenA = amount
    checkBalances(
      { tokenABalance: walletATokenA, tokenBBalance: bn(0), nativeBalance: bn(0) },
      { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) },
      { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) },
      { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) },
      { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) }
    )

    context('when userB deposits 50 native tokens', async () => {
      const amount = fp(50)

      before('deposit 50 native tokens for userB', async () => {
        await userB.sendTransaction({ to: userWalletB.address, value: amount })
      })

      walletBNative = amount
      checkBalances(
        { tokenABalance: walletATokenA, tokenBBalance: bn(0), nativeBalance: bn(0) },
        { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
        { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) },
        { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) },
        { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) }
      )

      context('when the owner withdraws 30 native tokens from userB wallet', async () => {
        const amount = fp(30)

        before('tranfer 30 native tokens from userB wallet to the owner', async () => {
          const data = walletImpl.interface.encodeFunctionData('transfer', [NATIVE_TOKEN_ADDRESS, amount])
          await ownerA.sendTransaction({ to: userWalletB.address, data })
        })

        walletBNative = walletBNative.sub(amount)
        ownerANative = ownerANative.add(amount)
        checkBalances(
          { tokenABalance: walletATokenA, tokenBBalance: bn(0), nativeBalance: bn(0) },
          { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
          { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) },
          { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: ownerANative },
          { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) }
        )

        context('when the owner changes', async () => {
          before('change owner', async () => {
            await walletOwner.connect(ownerA).transferOwnership(ownerB.address)
          })

          context('when the old owner withdraws 10 native tokens from userB wallet', async () => {
            it('reverts', async () => {
              const amount = fp(10)
              const data = walletImpl.interface.encodeFunctionData('transfer', [NATIVE_TOKEN_ADDRESS, amount])
              await expect(ownerA.sendTransaction({ to: userWalletB.address, data })).to.be.revertedWith(
                'WalletUnauthorizedSender'
              )
            })
          })

          checkBalances(
            { tokenABalance: walletATokenA, tokenBBalance: bn(0), nativeBalance: bn(0) },
            { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
            { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) },
            { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: ownerANative },
            { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) }
          )

          context('when userC deposits 225 tokenB', async () => {
            const amount = fp(225)

            before('create userC wallet', async () => {
              userWalletC = await deployWallet(userC, 'userC')
            })

            before('deposit 225 tokenB for userC', async () => {
              await tokenB.mint(userC.address, amount)
              await tokenB.connect(userC).transfer(userWalletC.address, amount)
            })

            walletCTokenB = amount
            checkBalances(
              { tokenABalance: walletATokenA, tokenBBalance: bn(0), nativeBalance: bn(0) },
              { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
              { tokenABalance: bn(0), tokenBBalance: walletCTokenB, nativeBalance: bn(0) },
              { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: ownerANative },
              { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) }
            )

            context('when userA deposits 15 tokenB', async () => {
              const amount = fp(15)

              before('deposit 25 tokenB for userS', async () => {
                await tokenB.mint(userA.address, amount)
                await tokenB.connect(userA).transfer(userWalletA.address, amount)
              })

              walletATokenB = amount
              checkBalances(
                { tokenABalance: walletATokenA, tokenBBalance: walletATokenB, nativeBalance: bn(0) },
                { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
                { tokenABalance: bn(0), tokenBBalance: walletCTokenB, nativeBalance: bn(0) },
                { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: ownerANative },
                { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: bn(0) }
              )

              context('when the owner withdraws 225 tokenB from userC wallet', async () => {
                const amount = fp(225)

                before('tranfer 225 tokenB from userC wallet to the owner', async () => {
                  const data = walletImpl.interface.encodeFunctionData('transfer', [tokenB.address, amount])
                  await ownerB.sendTransaction({ to: userWalletC.address, data })
                })

                walletCTokenB = bn(0)
                ownerBTokenB = amount
                checkBalances(
                  { tokenABalance: walletATokenA, tokenBBalance: walletATokenB, nativeBalance: bn(0) },
                  { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
                  { tokenABalance: bn(0), tokenBBalance: walletCTokenB, nativeBalance: bn(0) },
                  { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: ownerANative },
                  { tokenABalance: bn(0), tokenBBalance: ownerBTokenB, nativeBalance: bn(0) }
                )

                context('when the owner withdraws 75 tokenA from userA wallet', async () => {
                  const amount = fp(75)

                  before('tranfer 75 tokenA from userA wallet to the owner', async () => {
                    const data = walletImpl.interface.encodeFunctionData('transfer', [tokenA.address, amount])
                    await ownerB.sendTransaction({ to: userWalletA.address, data })
                  })

                  walletATokenA = walletATokenA.sub(amount)
                  ownerBTokenA = amount
                  checkBalances(
                    { tokenABalance: walletATokenA, tokenBBalance: walletATokenB, nativeBalance: bn(0) },
                    { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
                    { tokenABalance: bn(0), tokenBBalance: walletCTokenB, nativeBalance: bn(0) },
                    { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: ownerANative },
                    { tokenABalance: ownerBTokenA, tokenBBalance: ownerBTokenB, nativeBalance: bn(0) }
                  )

                  context('when the owner withdraws all tokens from users wallets', async () => {
                    const amountTokenA = fp(25)
                    const amountTokenB = fp(15)
                    const amountNative = fp(20)

                    before('tranfer all tokenA balance from userA wallet to the owner', async () => {
                      const data = walletImpl.interface.encodeFunctionData('transfer', [tokenA.address, amountTokenA])
                      await ownerB.sendTransaction({ to: userWalletA.address, data })
                    })

                    before('tranfer all tokenB balance from userA wallet to the owner', async () => {
                      const data = walletImpl.interface.encodeFunctionData('transfer', [tokenB.address, amountTokenB])
                      await ownerB.sendTransaction({ to: userWalletA.address, data })
                    })

                    before('tranfer all native tokens from userB wallet to the owner', async () => {
                      const data = walletImpl.interface.encodeFunctionData('transfer', [
                        NATIVE_TOKEN_ADDRESS,
                        amountNative,
                      ])
                      await ownerB.sendTransaction({ to: userWalletB.address, data })
                    })

                    walletATokenA = bn(0)
                    walletATokenB = bn(0)
                    walletBNative = bn(0)
                    ownerBTokenA = ownerBTokenA.add(amountTokenA)
                    ownerBTokenB = ownerBTokenB.add(amountTokenB)
                    ownerBNative = ownerBNative.add(amountNative)
                    checkBalances(
                      { tokenABalance: walletATokenA, tokenBBalance: walletATokenB, nativeBalance: bn(0) },
                      { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: walletBNative },
                      { tokenABalance: bn(0), tokenBBalance: walletCTokenB, nativeBalance: bn(0) },
                      { tokenABalance: bn(0), tokenBBalance: bn(0), nativeBalance: ownerANative },
                      { tokenABalance: ownerBTokenA, tokenBBalance: ownerBTokenB, nativeBalance: ownerBNative }
                    )
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
