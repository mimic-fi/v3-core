<h1 align="center">
  <a href="https://mimic.fi"><img src="https://www.mimic.fi/logo.png" alt="Mimic Finance" width="200"></a> 
</h1>

<h4 align="center">DeFi automation platform</h4>

<p align="center">
  <a href="https://badge.fury.io/js/@mimic-fi%2Fv3-price-oracle">
    <img src="https://badge.fury.io/js/@mimic-fi%2Fv3-price-oracle.svg" alt="NPM">
  </a>
  <a href="https://github.com/mimic-fi/v3-core/actions/workflows/ci-price-oracle.yml">
    <img src="https://github.com/mimic-fi/v3-core/actions/workflows/ci-price-oracle.yml/badge.svg" alt="CI Price Oracle">
  </a>
  <a href="https://discord.mimic.fi">
    <img alt="Discord" src="https://img.shields.io/discord/989984112397922325">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-GLP_3.0-green" alt="GLP 3.0">
  </a>
</p>

<p align="center">
  <a href="#content">Content</a> •
  <a href="#setup">Setup</a> •
  <a href="#security">Security</a> •
  <a href="#license">License</a>
</p>

---

## Content 

The Price Oracle contract is a vital component of the Mimic protocol, responsible for providing price data to support 
various operations and calculations within the decentralized ecosystem. It acts as an oracle, fetching and storing price
information from external sources, which can be accessed by other contracts or components within the Mimic protocol.

## Setup

To set up this project you'll need [git](https://git-scm.com) and [yarn](https://classic.yarnpkg.com) installed. 
From your command line:

```bash
# Clone this repository
$ git clone https://github.com/mimic-fi/v3-core

# Go into the repository's package
$ cd v3-core/packages/price-oracle

# Install dependencies
$ yarn

# Run tests to make sure everything is set up correctly
$ yarn test
```

## Security

To read more about our auditing and related security processes please refer to the [security section](https://docs.mimic.fi/miscellaneous/security) of our docs site.

However, if you found any potential issue in any of our smart contracts or in any piece of code you consider critical
for the safety of the protocol, please contact us through <a href="mailto:security@mimic.fi">security@mimic.fi</a>.

## License

GPL 3.0

---

> Website [mimic.fi](https://mimic.fi) &nbsp;&middot;&nbsp;
> GitHub [@mimic-fi](https://github.com/mimic-fi) &nbsp;&middot;&nbsp;
> Twitter [@mimicfi](https://twitter.com/mimicfi) &nbsp;&middot;&nbsp;
> Discord [mimic](https://discord.mimic.fi)
