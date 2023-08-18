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

import '@mimic-fi/v3-connectors/contracts/interfaces/liquidity/morpho/IMorphoAaveV3Connector.sol';
import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';

import './BaseMorphoAaveV3Task.sol';
import '../../interfaces/liquidity/morpho/IMorphoAaveV3Joiner.sol';

/**
 * @title Morpho-Aave V3 joiner
 * @dev Task that extends the base Morpho-Aave V3 task to join MorphoAaveV3 pools
 */
contract MorphoAaveV3Joiner is IMorphoAaveV3Joiner, BaseMorphoAaveV3Task {
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('MORPHO_AAVE_V3_JOINER');

    /**
     * @dev Morpho-Aave V3 join config. Only used in the initializer.
     */
    struct MorphoAaveV3JoinConfig {
        BaseMorphoAaveV3Config baseMorphoAaveV3Config;
    }

    /**
     * @dev Initializes a Morpho-Aave V3 joiner
     * @param config Morpho-Aave V3 join config
     */
    function initialize(MorphoAaveV3JoinConfig memory config) external virtual initializer {
        __MorphoAaveV3Joiner_init(config);
    }

    /**
     * @dev Initializes the Morpho-Aave V3 joiner. It does call upper contracts initializers.
     * @param config Morpho-Aave V3 join config
     */
    function __MorphoAaveV3Joiner_init(MorphoAaveV3JoinConfig memory config) internal onlyInitializing {
        __BaseMorphoAaveV3Task_init(config.baseMorphoAaveV3Config);
        __MorphoAaveV3Joiner_init_unchained(config);
    }

    /**
     * @dev Initializes the Morpho-Aave V3 joiner. It does not call upper contracts initializers.
     * @param config Morpho-Aave V3 join config
     */
    function __MorphoAaveV3Joiner_init_unchained(MorphoAaveV3JoinConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Morpho-Aave V3 joiner task
     * @param token Address of the token to be joined with
     * @param amount Amount of tokens to be joined with
     * @param maxIterations Maximum number of iterations allowed during the matching process. Using 4 is recommended by Morpho.
     */
    function call(address token, uint256 amount, uint256 maxIterations)
        external
        override
        authP(authParams(token, amount, maxIterations))
    {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeMorphoAaveV3Joiner(token, amount, maxIterations);
        _call(token, amount, maxIterations);
        _afterMorphoAaveV3Joiner(token, amount);
    }

    /**
     * @dev Executes the Morpho-Aave V3 joiner task
     * @param token Address of the token to be joined with
     * @param amount Amount of tokens to be joined with
     * @param maxIterations Maximum number of iterations allowed during the matching process. Using 4 is recommended by Morpho.
     */
    function _call(address token, uint256 amount, uint256 maxIterations) internal virtual {
        bytes memory connectorData = abi.encodeWithSelector(
            IMorphoAaveV3Connector.join.selector,
            token,
            amount,
            maxIterations
        );
        ISmartVault(smartVault).execute(connector, connectorData);
    }

    /**
     * @dev Before Morpho-Aave V3 joiner hook
     */
    function _beforeMorphoAaveV3Joiner(address token, uint256 amount, uint256 maxIterations) internal virtual {
        _beforeBaseMorphoAaveV3Task(token, amount);
        if (maxIterations == 0) revert TaskMaxIterationsZero();
    }

    /**
     * @dev After Morpho-Aave V3 joiner hook
     */
    function _afterMorphoAaveV3Joiner(address token, uint256 amount) internal virtual {
        _afterBaseMorphoAaveV3Task(token, amount);
    }
}
