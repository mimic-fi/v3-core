import {
  advanceTime,
  assertEvent,
  BigNumberish,
  bn,
  currentTimestamp,
  DAY,
  deploy,
  deployProxy,
  deployTokenMock,
  fp,
  getSigner,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract, ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'

describe('PriceOracle', () => {
  let priceOracle: Contract, authorizer: Contract
  let owner: SignerWithAddress, signer: SignerWithAddress

  const PIVOT = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' // ETH
  const BASE = '0x0000000000000000000000000000000000000001'
  const QUOTE = '0x0000000000000000000000000000000000000002'
  const FEED = '0x0000000000000000000000000000000000000003'

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, signer] = await getSigners()
  })

  beforeEach('create price oracle', async () => {
    authorizer = await deployProxy(
      '@mimic-fi/v3-authorizer/artifacts/contracts/Authorizer.sol/Authorizer',
      [],
      [[owner.address]]
    )

    priceOracle = await deployProxy(
      'PriceOracle',
      [],
      [authorizer.address, signer.address, PIVOT, [{ base: BASE, quote: QUOTE, feed: FEED }]]
    )
  })

  describe('initialization', async () => {
    it('has an authorizer reference', async () => {
      expect(await priceOracle.authorizer()).to.be.equal(authorizer.address)
    })

    it('sets the pivot properly', async () => {
      expect(await priceOracle.pivot()).to.be.equal(PIVOT)
    })

    it('sets the allowed signer properly', async () => {
      expect(await priceOracle.isSignerAllowed(signer.address)).to.be.true
    })

    it('sets the initial feeds properly', async () => {
      expect(await priceOracle.getFeed(BASE, QUOTE)).to.be.equal(FEED)
    })
  })

  describe('setSigner', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setSignerRole = priceOracle.interface.getSighash('setSigner')
        await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setSignerRole, [])
        priceOracle = priceOracle.connect(owner)
      })

      context('when allowing the signer', () => {
        const allowed = true

        it('allows the signer', async () => {
          await priceOracle.setSigner(owner.address, allowed)
          expect(await priceOracle.isSignerAllowed(owner.address)).to.be.true
        })

        it('does not affect other signers', async () => {
          await priceOracle.setSigner(owner.address, allowed)
          expect(await priceOracle.isSignerAllowed(signer.address)).to.be.true
        })

        it('emits an event', async () => {
          const tx = await priceOracle.setSigner(owner.address, allowed)
          await assertEvent(tx, 'SignerSet', { signer: owner, allowed })
        })
      })

      context('when removing the signer', () => {
        const allowed = false

        it('disallows the signer', async () => {
          await priceOracle.setSigner(owner.address, allowed)
          expect(await priceOracle.isSignerAllowed(owner.address)).to.be.false
        })

        it('does not affect other signers', async () => {
          await priceOracle.setSigner(owner.address, allowed)
          expect(await priceOracle.isSignerAllowed(signer.address)).to.be.true
        })

        it('emits an event', async () => {
          const tx = await priceOracle.setSigner(owner.address, allowed)
          await assertEvent(tx, 'SignerSet', { signer: owner, allowed })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(priceOracle.setSigner(owner.address, true)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setFeed', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setFeedRole = await priceOracle.interface.getSighash('setFeed')
        await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
        priceOracle = priceOracle.connect(owner)
      })

      const itCanBeSet = () => {
        it('can be set', async () => {
          const tx = await priceOracle.setFeed(BASE, QUOTE, FEED)

          expect(await priceOracle.getFeed(BASE, QUOTE)).to.be.equal(FEED)

          await assertEvent(tx, 'FeedSet', { base: BASE, quote: QUOTE, feed: FEED })
        })
      }

      const itCanBeUnset = () => {
        it('can be unset', async () => {
          const tx = await priceOracle.setFeed(BASE, QUOTE, ZERO_ADDRESS)

          expect(await priceOracle.getFeed(BASE, QUOTE)).to.be.equal(ZERO_ADDRESS)

          await assertEvent(tx, 'FeedSet', { base: BASE, quote: QUOTE, feed: ZERO_ADDRESS })
        })
      }

      context('when the feed is set', () => {
        beforeEach('set feed', async () => {
          await priceOracle.setFeed(BASE, QUOTE, FEED)
          expect(await priceOracle.getFeed(BASE, QUOTE)).to.be.equal(FEED)
        })

        itCanBeSet()
        itCanBeUnset()
      })

      context('when the feed is not set', () => {
        beforeEach('unset feed', async () => {
          await priceOracle.setFeed(BASE, QUOTE, ZERO_ADDRESS)
          expect(await priceOracle.getFeed(BASE, QUOTE)).to.be.equal(ZERO_ADDRESS)
        })

        itCanBeSet()
        itCanBeUnset()
      })
    })

    context('when sender is not authorized', () => {
      it('reverts', async () => {
        await expect(priceOracle.setFeed(BASE, QUOTE, FEED)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('getPrice (on-chain)', () => {
    let base: Contract, quote: Contract

    beforeEach('authorize sender', async () => {
      const setFeedRole = await priceOracle.interface.getSighash('setFeed')
      await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
      priceOracle = priceOracle.connect(owner)
    })

    const getPrice = async (): Promise<BigNumber> => {
      return priceOracle['getPrice(address,address)'](base.address, quote.address)
    }

    context('when there is no feed', () => {
      beforeEach('deploy tokens', async () => {
        base = await deployTokenMock('BASE', 18)
        quote = await deployTokenMock('QUOTE', 18)
      })

      it('reverts', async () => {
        await expect(getPrice()).to.be.revertedWith('PriceOracleMissingFeed')
      })
    })

    context('when there is a direct feed', () => {
      const PRICE = bn(3)

      const itReverts = (baseDecimals: number, quoteDecimals: number) => {
        beforeEach('deploy tokens', async () => {
          base = await deployTokenMock('BASE', baseDecimals)
          quote = await deployTokenMock('QUOTE', quoteDecimals)
        })

        it('reverts', async () => {
          await expect(getPrice()).to.be.revertedWith('PriceOracleBaseDecimalsTooBig')
        })
      }

      const itQuotesThePriceCorrectly = (baseDecimals: number, quoteDecimals: number, feedDecimals: number) => {
        const reportedPrice = PRICE.mul(bn(10).pow(feedDecimals))
        const resultDecimals = quoteDecimals + 18 - baseDecimals
        const expectedPrice = PRICE.mul(bn(10).pow(resultDecimals))

        beforeEach('deploy tokens', async () => {
          base = await deployTokenMock('BASE', baseDecimals)
          quote = await deployTokenMock('QUOTE', quoteDecimals)
        })

        beforeEach('set feed', async () => {
          const feed = await deploy('FeedMock', [reportedPrice, feedDecimals])
          await priceOracle.setFeed(base.address, quote.address, feed.address)
        })

        it(`expresses the price with ${resultDecimals} decimals`, async () => {
          expect(await getPrice()).to.be.equal(expectedPrice)
        })
      }

      context('when the base has 6 decimals', () => {
        const baseDecimals = 6

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })

      context('when the base has 18 decimals', () => {
        const baseDecimals = 18

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })

      context('when the base has 20 decimals', () => {
        const baseDecimals = 20

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })

      context('when the base has 38 decimals', () => {
        const baseDecimals = 38

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          itReverts(baseDecimals, quoteDecimals)
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          itReverts(baseDecimals, quoteDecimals)
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })
    })

    context('when there is an inverse feed', () => {
      const PRICE = bn(3)

      const itReverts = (baseDecimals: number, quoteDecimals: number) => {
        beforeEach('deploy tokens', async () => {
          base = await deployTokenMock('BASE', baseDecimals)
          quote = await deployTokenMock('QUOTE', quoteDecimals)
        })

        it('reverts', async () => {
          await expect(getPrice()).to.be.revertedWith('PriceOracleBaseDecimalsTooBig')
        })
      }

      const itQuotesThePriceCorrectly = (baseDecimals: number, quoteDecimals: number, feedDecimals: number) => {
        const reportedInversePrice = bn(10).pow(feedDecimals).div(PRICE)
        const resultDecimals = quoteDecimals + 18 - baseDecimals
        const expectedPrice = PRICE.mul(bn(10).pow(resultDecimals))

        beforeEach('deploy tokens', async () => {
          base = await deployTokenMock('BASE', baseDecimals)
          quote = await deployTokenMock('QUOTE', quoteDecimals)
        })

        beforeEach('set inverse feed', async () => {
          const feed = await deploy('FeedMock', [reportedInversePrice, feedDecimals])
          await priceOracle.setFeed(quote.address, base.address, feed.address)
        })

        it(`expresses the price with ${resultDecimals} decimals`, async () => {
          const price = await getPrice()

          if (feedDecimals > 18) {
            // There is no precision error
            expect(price).to.be.eq(expectedPrice)
          } else if (resultDecimals > feedDecimals) {
            const expectedError = reportedInversePrice.mod(10).add(1)
            const errorPrecision = resultDecimals - feedDecimals
            const upscaledError = expectedError.mul(bn(10).pow(errorPrecision))
            const expectedPriceWithError = expectedPrice.add(upscaledError)
            expect(price).to.be.at.least(expectedPrice)
            expect(price).to.be.at.most(expectedPriceWithError)
          }
        })
      }

      context('when the base has 6 decimals', () => {
        const baseDecimals = 6

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })

      context('when the base has 18 decimals', () => {
        const baseDecimals = 18

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })

      context('when the base has 20 decimals', () => {
        const baseDecimals = 20

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })

      context('when the base has 38 decimals', () => {
        const baseDecimals = 38

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          itReverts(baseDecimals, quoteDecimals)
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          itReverts(baseDecimals, quoteDecimals)
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the feed has 6 decimals', () => {
            const feedDecimals = 6

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 18 decimals', () => {
            const feedDecimals = 18

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })

          context('when the feed has 20 decimals', () => {
            const feedDecimals = 20

            itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, feedDecimals)
          })
        })
      })
    })

    context('when there are pivot feeds', () => {
      const BASE_ETH_PRICE = bn(6)
      const QUOTE_ETH_PRICE = bn(2)

      const itReverts = (baseDecimals: number, quoteDecimals: number) => {
        beforeEach('deploy tokens', async () => {
          base = await deployTokenMock('BASE', baseDecimals)
          quote = await deployTokenMock('QUOTE', quoteDecimals)
        })

        it('reverts', async () => {
          await expect(getPrice()).to.be.revertedWith('PriceOracleBaseDecimalsTooBig')
        })
      }

      const itQuotesThePriceCorrectly = (
        baseDecimals: number,
        quoteDecimals: number,
        baseFeedDecimals: number,
        quoteFeedDecimals: number
      ) => {
        const reportedBasePrice = BASE_ETH_PRICE.mul(bn(10).pow(baseFeedDecimals))
        const reportedQuotePrice = QUOTE_ETH_PRICE.mul(bn(10).pow(quoteFeedDecimals))
        const resultDecimals = quoteDecimals + 18 - baseDecimals
        const expectedPrice = BASE_ETH_PRICE.div(QUOTE_ETH_PRICE).mul(bn(10).pow(resultDecimals))

        beforeEach('deploy tokens', async () => {
          base = await deployTokenMock('BASE', baseDecimals)
          quote = await deployTokenMock('QUOTE', quoteDecimals)
        })

        beforeEach('set feed', async () => {
          const baseFeed = await deploy('FeedMock', [reportedBasePrice, baseFeedDecimals])
          await priceOracle.setFeed(base.address, PIVOT, baseFeed.address)

          const quoteFeed = await deploy('FeedMock', [reportedQuotePrice, quoteFeedDecimals])
          await priceOracle.setFeed(quote.address, PIVOT, quoteFeed.address)
        })

        it(`expresses the price with ${resultDecimals} decimals`, async () => {
          expect(await getPrice()).to.be.equal(expectedPrice)
        })
      }

      context('when the base has 6 decimals', () => {
        const baseDecimals = 6

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })
      })

      context('when the base has 18 decimals', () => {
        const baseDecimals = 18

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })
      })

      context('when the base has 20 decimals', () => {
        const baseDecimals = 20

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })
      })

      context('when the base has 38 decimals', () => {
        const baseDecimals = 38

        context('when the quote has 6 decimals', () => {
          const quoteDecimals = 6

          itReverts(baseDecimals, quoteDecimals)
        })

        context('when the quote has 18 decimals', () => {
          const quoteDecimals = 18

          itReverts(baseDecimals, quoteDecimals)
        })

        context('when the quote has 20 decimals', () => {
          const quoteDecimals = 20

          context('when the base feed has 6 decimals', () => {
            const baseFeedDecimals = 6

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 18 decimals', () => {
            const baseFeedDecimals = 18

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })

          context('when the base feed has 20 decimals', () => {
            const baseFeedDecimals = 20

            context('when the quote feed has 6 decimals', () => {
              const quoteFeedDecimals = 6

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 18 decimals', () => {
              const quoteFeedDecimals = 18

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })

            context('when the quote feed has 20 decimals', () => {
              const quoteFeedDecimals = 20

              itQuotesThePriceCorrectly(baseDecimals, quoteDecimals, baseFeedDecimals, quoteFeedDecimals)
            })
          })
        })
      })
    })
  })

  describe('getPrice (off-chain)', () => {
    let data = '0x'
    let base: Contract, quote: Contract, feed: Contract

    const OFF_CHAIN_ORACLE_PRICE = fp(5)
    const SMART_VAULT_ORACLE_PRICE = fp(10)

    const getPrice = async (): Promise<BigNumber> => {
      return priceOracle['getPrice(address,address,bytes)'](base.address, quote.address, data)
    }

    beforeEach('deploy base and quote', async () => {
      base = await deployTokenMock('BASE', 18)
      quote = await deployTokenMock('QUOTE', 18)
      feed = await deploy('FeedMock', [SMART_VAULT_ORACLE_PRICE, 18])
    })

    const setUpSmartVaultOracleFeed = () => {
      beforeEach('set smart vault oracle', async () => {
        const setFeedRole = await priceOracle.interface.getSighash('setFeed')
        await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
        await priceOracle.connect(owner).setFeed(base.address, quote.address, feed.address)
      })
    }

    const itRetrievesThePriceFromTheSmartVaultOracle = () => {
      it('retrieves the pair price from the smart vault oracle', async () => {
        expect(await getPrice()).to.be.equal(SMART_VAULT_ORACLE_PRICE)
      })
    }

    const itRetrievesThePriceFromTheOffChainFeed = () => {
      it('retrieves the pair price from the off-chain feed', async () => {
        expect(await getPrice()).to.be.equal(OFF_CHAIN_ORACLE_PRICE)
      })
    }

    const itRevertsDueToMissingFeed = () => {
      it('reverts due to missing feed', async () => {
        await expect(getPrice()).to.be.revertedWith('PriceOracleMissingFeed')
      })
    }

    const itRevertsDueToInvalidSignature = () => {
      it('reverts due to invalid signature', async () => {
        await expect(getPrice()).to.be.revertedWith('PriceOracleInvalidSigner')
      })
    }

    context('when the feed data is well-formed', () => {
      type PriceData = { base: string; quote: string; rate: BigNumberish; deadline: BigNumberish }

      let pricesData: PriceData[]

      const encodeFeedsWithSignature = async (prices: PriceData[], signer: SignerWithAddress): Promise<string> => {
        const PricesDataType = 'PriceData(address base, address quote, uint256 rate, uint256 deadline)[]'
        const encodedPrices = await defaultAbiCoder.encode([PricesDataType], [prices])
        const message = ethers.utils.solidityKeccak256(['bytes'], [encodedPrices])
        const signature = await signer.signMessage(ethers.utils.arrayify(message))
        return defaultAbiCoder.encode([PricesDataType, 'bytes signature'], [prices, signature])
      }

      const itRetrievesPricesProperly = () => {
        context('when the feed data is up-to-date', () => {
          context('when there is no feed in the smart vault oracle', () => {
            itRetrievesThePriceFromTheOffChainFeed()
          })

          context('when there is a feed in the smart vault oracle', () => {
            setUpSmartVaultOracleFeed()
            itRetrievesThePriceFromTheOffChainFeed()
          })
        })

        context('when the feed data is outdated', () => {
          beforeEach('advance time', async () => {
            await advanceTime(DAY * 2)
          })

          const itRevertsDueToOutdatedFeed = () => {
            it('reverts due to outdated feed', async () => {
              await expect(getPrice()).to.be.revertedWith('PriceOracleOutdatedPrice')
            })
          }

          context('when there is no feed in the smart vault oracle', () => {
            itRevertsDueToOutdatedFeed()
          })

          context('when there is a feed in the smart vault oracle', () => {
            setUpSmartVaultOracleFeed()
            itRevertsDueToOutdatedFeed()
          })
        })
      }

      context('when there is no off-chain feed given', () => {
        beforeEach('build feed data', async () => {
          pricesData = []
        })

        context('when the feed data is properly signed', () => {
          beforeEach('sign with known signer', async () => {
            const signer = await getSigner(2)
            data = await encodeFeedsWithSignature(pricesData, signer)

            const setSignerRole = priceOracle.interface.getSighash('setSigner')
            await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setSignerRole, [])
            await priceOracle.connect(owner).setSigner(signer.address, true)
          })

          context('when there is no feed in the smart vault oracle', () => {
            itRevertsDueToMissingFeed()
          })

          context('when there is a feed in the smart vault oracle', () => {
            setUpSmartVaultOracleFeed()
            itRetrievesThePriceFromTheSmartVaultOracle()
          })
        })

        context('when the feed data is not properly signed', () => {
          beforeEach('sign with unknown signer', async () => {
            const signer = await getSigner()
            data = await encodeFeedsWithSignature(pricesData, signer)
          })

          context('when there is no feed in the smart vault oracle', () => {
            itRevertsDueToInvalidSignature()
          })

          context('when there is a feed in the smart vault oracle', () => {
            setUpSmartVaultOracleFeed()
            itRevertsDueToInvalidSignature()
          })
        })
      })

      context('when there is only one feed given', () => {
        beforeEach('build feed data', async () => {
          pricesData = [
            {
              base: base.address,
              quote: quote.address,
              rate: OFF_CHAIN_ORACLE_PRICE,
              deadline: (await currentTimestamp()).add(DAY),
            },
          ]
        })

        context('when the feed data is properly signed', () => {
          beforeEach('sign with known signer', async () => {
            const signer = await getSigner()
            data = await encodeFeedsWithSignature(pricesData, signer)

            const setSignerRole = priceOracle.interface.getSighash('setSigner')
            await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setSignerRole, [])
            await priceOracle.connect(owner).setSigner(signer.address, true)
          })

          itRetrievesPricesProperly()
        })

        context('when the feed data is not properly signed', () => {
          beforeEach('sign with unknown signer', async () => {
            const signer = await getSigner()
            data = await encodeFeedsWithSignature(pricesData, signer)
          })

          context('when there is no feed in the smart vault oracle', () => {
            itRevertsDueToInvalidSignature()
          })

          context('when there is a feed in the smart vault oracle', () => {
            setUpSmartVaultOracleFeed()
            itRevertsDueToInvalidSignature()
          })
        })
      })

      context('when there are many feeds given', () => {
        let anotherBase: Contract, anotherQuote: Contract

        before('deploy another base and quote', async () => {
          anotherBase = await deployTokenMock('BASE', 18)
          anotherQuote = await deployTokenMock('QUOTE', 18)
        })

        beforeEach('build feed data', async () => {
          const deadline = (await currentTimestamp()).add(DAY)
          pricesData = [
            { base: base.address, quote: anotherQuote.address, rate: OFF_CHAIN_ORACLE_PRICE.mul(2), deadline },
            { base: base.address, quote: quote.address, rate: OFF_CHAIN_ORACLE_PRICE, deadline },
            { base: anotherBase.address, quote: anotherQuote.address, rate: OFF_CHAIN_ORACLE_PRICE.mul(3), deadline },
          ]
        })

        context('when the feed data is properly signed', () => {
          beforeEach('sign with known signer', async () => {
            const signer = await getSigner()
            data = await encodeFeedsWithSignature(pricesData, signer)

            const setSignerRole = priceOracle.interface.getSighash('setSigner')
            await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setSignerRole, [])
            await priceOracle.connect(owner).setSigner(signer.address, true)
          })

          itRetrievesPricesProperly()
        })

        context('when the feed data is not properly signed', () => {
          beforeEach('sign with unknown signer', async () => {
            const signer = await getSigner()
            data = await encodeFeedsWithSignature(pricesData, signer)
          })

          context('when there is no feed in the smart vault oracle', () => {
            itRevertsDueToInvalidSignature()
          })

          context('when there is a feed in the smart vault oracle', () => {
            setUpSmartVaultOracleFeed()
            itRevertsDueToInvalidSignature()
          })
        })
      })
    })

    context('when the feed data is malformed', () => {
      beforeEach('set malformed extra calldata', async () => {
        data = '0xaabbccdd'
      })

      context('when there is no feed in the smart vault oracle', () => {
        itRevertsDueToMissingFeed()
      })

      context('when there is a feed in the smart vault oracle', () => {
        setUpSmartVaultOracleFeed()
        itRetrievesThePriceFromTheSmartVaultOracle()
      })
    })
  })
})
