import { bn, deploy } from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('PriceOracle', () => {
  let oracle: Contract

  const PIVOT = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' // ETH

  beforeEach('create oracle', async () => {
    oracle = await deploy('PriceOracle', [PIVOT])
  })

  describe('getPrice', () => {
    let provider: Contract, base: Contract, quote: Contract

    beforeEach('deploy provider', async () => {
      provider = await deploy('PriceFeedProvider')
    })

    context('when there is no feed', () => {
      beforeEach('deploy tokens', async () => {
        base = await deploy('TokenMock', ['BASE', 18])
        quote = await deploy('TokenMock', ['QUOTE', 18])
      })

      it('reverts', async () => {
        await expect(oracle.getPrice(provider.address, base.address, quote.address)).to.be.revertedWith(
          'MISSING_PRICE_FEED'
        )
      })
    })

    context('when there is a direct feed', () => {
      const PRICE = bn(3)

      const itReverts = (baseDecimals: number, quoteDecimals: number) => {
        beforeEach('deploy tokens', async () => {
          base = await deploy('TokenMock', ['BASE', baseDecimals])
          quote = await deploy('TokenMock', ['QUOTE', quoteDecimals])
        })

        it('reverts', async () => {
          await expect(oracle.getPrice(provider.address, base.address, quote.address)).to.be.revertedWith(
            'BASE_DECIMALS_TOO_BIG'
          )
        })
      }

      const itQuotesThePriceCorrectly = (baseDecimals: number, quoteDecimals: number, feedDecimals: number) => {
        const reportedPrice = PRICE.mul(bn(10).pow(feedDecimals))
        const resultDecimals = quoteDecimals + 18 - baseDecimals
        const expectedPrice = PRICE.mul(bn(10).pow(resultDecimals))

        beforeEach('deploy tokens', async () => {
          base = await deploy('TokenMock', ['BASE', baseDecimals])
          quote = await deploy('TokenMock', ['QUOTE', quoteDecimals])
        })

        beforeEach('set feed', async () => {
          const feed = await deploy('FeedMock', [reportedPrice, feedDecimals])
          await provider.setPriceFeeds([base.address], [quote.address], [feed.address])
        })

        it(`expresses the price with ${resultDecimals} decimals`, async () => {
          expect(await oracle.getPrice(provider.address, base.address, quote.address)).to.be.equal(expectedPrice)
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
          base = await deploy('TokenMock', ['BASE', baseDecimals])
          quote = await deploy('TokenMock', ['QUOTE', quoteDecimals])
        })

        it('reverts', async () => {
          await expect(oracle.getPrice(provider.address, base.address, quote.address)).to.be.revertedWith(
            'BASE_DECIMALS_TOO_BIG'
          )
        })
      }

      const itQuotesThePriceCorrectly = (baseDecimals: number, quoteDecimals: number, feedDecimals: number) => {
        const reportedInversePrice = bn(10).pow(feedDecimals).div(PRICE)
        const resultDecimals = quoteDecimals + 18 - baseDecimals
        const expectedPrice = PRICE.mul(bn(10).pow(resultDecimals))

        beforeEach('deploy tokens', async () => {
          base = await deploy('TokenMock', ['BASE', baseDecimals])
          quote = await deploy('TokenMock', ['QUOTE', quoteDecimals])
        })

        beforeEach('set inverse feed', async () => {
          const feed = await deploy('FeedMock', [reportedInversePrice, feedDecimals])
          await provider.setPriceFeeds([quote.address], [base.address], [feed.address])
        })

        it(`expresses the price with ${resultDecimals} decimals`, async () => {
          const price = await oracle.getPrice(provider.address, base.address, quote.address)

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
          base = await deploy('TokenMock', ['BASE', baseDecimals])
          quote = await deploy('TokenMock', ['QUOTE', quoteDecimals])
        })

        it('reverts', async () => {
          await expect(oracle.getPrice(provider.address, base.address, quote.address)).to.be.revertedWith(
            'BASE_DECIMALS_TOO_BIG'
          )
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
          base = await deploy('TokenMock', ['BASE', baseDecimals])
          quote = await deploy('TokenMock', ['QUOTE', quoteDecimals])
        })

        beforeEach('set feed', async () => {
          const baseFeed = await deploy('FeedMock', [reportedBasePrice, baseFeedDecimals])
          const quoteFeed = await deploy('FeedMock', [reportedQuotePrice, quoteFeedDecimals])
          await provider.setPriceFeeds(
            [base.address, quote.address],
            [PIVOT, PIVOT],
            [baseFeed.address, quoteFeed.address]
          )
        })

        it(`expresses the price with ${resultDecimals} decimals`, async () => {
          expect(await oracle.getPrice(provider.address, base.address, quote.address)).to.be.equal(expectedPrice)
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
})
