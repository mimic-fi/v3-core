// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.17;

import '../../contracts/Relayer.sol';

contract RelayerHarness is Relayer {
    constructor(address executor, address collector, address owner) Relayer(executor, collector, owner) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function payTransactionGasToRelayer(address smartVault, uint256 amount) external {
        _payTransactionGasToRelayer(smartVault, amount);
    }
}
