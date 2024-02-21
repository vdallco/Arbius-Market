# Arbius-Market
A marketplace for AIUS miners and holders to swap to/from AIUS. All AIUS is directly staked to validators on ArbiusEngine on Arbitrum Nova.

# How it works

- AIUS Miners who are looking for more AIUS to stake may deposit ETH or ERC-20 tokens into the Market contract.

- AIUS holders may deposit their AIUS to the Market contract, where it's staked directly to the incentivized validator, in return for a proportional amount of ETH/token rewards.


# How to build it

Make sure you have browserify installed before running this command:

```
browserify bribes.js -o bundle.js
```

# Security disclaimers

- This Solidity contract has not been formally audited. 
- This is not an official project of, and has no association with, the Arbius team.