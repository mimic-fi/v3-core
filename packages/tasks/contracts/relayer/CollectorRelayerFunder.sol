// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '../primitives/Collector.sol';
import './BaseRelayerFundTask.sol';

/**
 * @title Collector relayer funder
 * @dev Task used to convert funds in order to pay relayers using an collector
 */
contract CollectorRelayerFunder is BaseRelayerFundTask, Collector {
    /**
     * @dev Disables the default collector initializer
     */
    function initialize(CollectConfig memory) external pure override {
        revert('COLLECTOR_INITIALIZER_DISABLED');
    }

    /**
     * @dev Initializes the collector relayer funder
     * @param config Collect config
     * @param relayer Relayer address
     */
    function initializeCollectorRelayerFunder(CollectConfig memory config, address relayer)
        external
        virtual
        initializer
    {
        __CollectorRelayerFunder_init(config, relayer);
    }

    /**
     * @dev Initializes the collector relayer funder. It does call upper contracts initializers.
     * @param config Collect config
     * @param relayer Relayer address
     */
    function __CollectorRelayerFunder_init(CollectConfig memory config, address relayer) internal onlyInitializing {
        __Collector_init(config);
        __BaseRelayerFundTask_init_unchained(BaseRelayerFundConfig(relayer, config.taskConfig));
        __CollectorRelayerFunder_init_unchained(config, relayer);
    }

    /**
     * @dev Initializes the collector relayer funder. It does not call upper contracts initializers.
     * @param config Collect config
     * @param relayer Relayer address
     */
    function __CollectorRelayerFunder_init_unchained(CollectConfig memory config, address relayer)
        internal
        onlyInitializing
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Tells the address from where the token amounts to execute this task are fetched
     */
    function getTokensSource() public view override(Collector, IBaseTask, BaseTask) returns (address) {
        return Collector.getTokensSource();
    }

    /**
     * @dev Tells the `token` amount to be funded
     * @param token Address of the token to be used to fund the relayer
     */
    function getTaskAmount(address token)
        public
        view
        override(BaseRelayerFundTask, IBaseTask, BaseTask)
        returns (uint256)
    {
        return BaseRelayerFundTask.getTaskAmount(token);
    }

    /**
     * @dev Before token threshold task hook
     */
    function _beforeTokenThresholdTask(address token, uint256 amount)
        internal
        override(BaseRelayerFundTask, TokenThresholdTask)
    {
        BaseRelayerFundTask._beforeTokenThresholdTask(token, amount);
    }

    /**
     * @dev Sets the balance connectors. Previous balance connector must be unset.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal override(Collector, BaseTask) {
        Collector._setBalanceConnectors(previous, next);
    }
}
