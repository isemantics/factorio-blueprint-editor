import { Blueprint } from './blueprint'
import Immutable from 'immutable'
import factorioData from './factorioData'
import util from '../util'
import { Area } from './positionGrid'

export default (BP: Blueprint) => {
    Immutable.Map.prototype.entity = function() {
        // tslint:disable-next-line:no-this-assignment
        const rawEntity = this
        return {
            get entity_number() { return rawEntity.get('entity_number') },
            get name() { return rawEntity.get('name') },

            get type() { return factorioData.getEntity(this.name).type },
            get entityData() { return factorioData.getEntity(this.name) },
            get recipeData() { return factorioData.getRecipe(this.name) },
            get itemData() { return factorioData.getItem(this.name) },
            get size() { return util.switchSizeBasedOnDirection(this.entityData.size, this.direction) },

            get position() { return rawEntity.get('position').toJS() },
            get direction() { return rawEntity.get('direction') || 0 },
            get directionType() { return rawEntity.get('type') },
            get recipe() { return rawEntity.get('recipe') },

            set recipe(recipeName: string) {
                BP.operation(this.entity_number, 'Changed recipe', entities => (
                    entities.withMutations(map => {
                        map.setIn([this.entity_number, 'recipe'], recipeName)

                        const modules = this.modules
                        if (modules && recipeName && !factorioData.getItem('productivity-module').limitation.includes(recipeName)) {
                            for (const k in modules) {
                                if (k.includes('productivity-module')) delete modules[k]
                            }
                            map.setIn([this.entity_number, 'items'], Object.keys(modules).length ? Immutable.fromJS(modules) : undefined)
                        }
                    })
                ))
            },

            get acceptedRecipes() {
                if (!this.entityData.crafting_categories) return
                const acceptedRecipes: string[] = []
                const recipes = factorioData.getRecipes()
                const cc = this.entityData.crafting_categories
                for (const k in recipes) {
                    if (cc.includes(recipes[k].category) || (cc.includes('crafting') && !recipes[k].category)) {
                        const recipe = (recipes[k].normal ? recipes[k].normal : recipes[k])
                        if (!((this.name === 'assembling-machine-1' && recipe.ingredients.length > 2) ||
                            (this.name === 'assembling-machine-2' && recipe.ingredients.length > 4))
                        ) {
                            acceptedRecipes.push(k)
                        }
                    }
                }
                return acceptedRecipes
            },

            get acceptedModules() {
                if (!this.entityData.module_specification) return
                const ommitProductivityModules = this.name === 'beacon' ||
                    (this.recipe && !factorioData.getItem('productivity-module').limitation.includes(this.recipe))
                const items = factorioData.getItems()
                const acceptedModules: string[] = []
                for (const k in items) {
                    if (items[k].type === 'module' && !(k.includes('productivity-module') && ommitProductivityModules)) acceptedModules.push(k)
                }
                return acceptedModules
            },

            set direction(direction: number) {
                BP.operation(this.entity_number, 'Set entity direction to ' + direction,
                    entities => entities.setIn([this.entity_number, 'direction'], direction)
                )
            },

            get modules() {
                const i = rawEntity.get('items')
                return i ? i.toJS() : undefined
            },

            get modulesList() {
                const i = rawEntity.get('items')
                if (!i) return
                const modules = i.toJS()
                const moduleList = []
                for (const n in modules) {
                    for (let i = 0; i < modules[n]; i++) {
                        moduleList.push(n)
                    }
                }
                return moduleList
            },

            set modulesList(list: any) {
                const modules = {}
                for (const m of list) {
                    if (Object.keys(modules).includes(m)) {
                        modules[m]++
                    } else {
                        modules[m] = 1
                    }
                }
                BP.operation(this.entity_number, 'Changed modules',
                    entities => entities.setIn([this.entity_number, 'items'], Immutable.fromJS(modules))
                )
            },

            get splitterInputPriority() {
                return rawEntity.get('input_priority')
            },

            get splitterOutputPriority() {
                return rawEntity.get('output_priority')
            },

            get splitterFilter() {
                return rawEntity.get('filter')
            },

            get inserterFilters() {
                const f = rawEntity.get('filters')
                return f ? f.toJS() : undefined
            },

            get constantCombinatorFilters() {
                const f = rawEntity.getIn(['control_behavior', 'filters'])
                return f ? f.toJS() : undefined
            },

            get logisticChestFilters() {
                const f = rawEntity.get('request_filters')
                return f ? f.toJS() : undefined
            },

            get deciderCombinatorConditions() {
                const c = rawEntity.getIn(['control_behavior', 'decider_conditions'])
                return c ? c.toJS() : undefined
            },

            get arithmeticCombinatorConditions() {
                const c = rawEntity.getIn(['control_behavior', 'arithmetic_conditions'])
                return c ? c.toJS() : undefined
            },

            get hasConnections() {
                return rawEntity.get('connections') !== undefined
            },

            get connections() {
                const c = rawEntity.get('connections')
                return c ? c.toJS() : undefined
            },

            get connectedEntities() {
                const c = rawEntity.get('connections')
                if (!c) return
                const connections = c.toJS()
                const entities = []
                for (const side in connections) {
                    for (const color in connections[side]) {
                        for (const c of connections[side][color]) {
                            entities.push(c.entity_id)
                        }
                    }
                }
                return entities
            },

            get chemicalPlantDontConnectOutput() {
                const r = this.recipe
                if (!r) return false
                const rData = factorioData.getRecipe(r)
                const recipe = (rData.normal ? rData.normal : rData)
                if (recipe.result || recipe.results[0].type === 'item') return true
                return false
            },

            get trainStopColor() {
                const c = rawEntity.get('color')
                return c ? c.toJS() : undefined
            },

            get operator() {
                if (this.name === 'decider-combinator') {
                    const cb = rawEntity.get('control_behavior')
                    if (cb) return cb.getIn(['decider_conditions', 'comparator'])
                }
                if (this.name === 'arithmetic-combinator') {
                    const cb = rawEntity.get('control_behavior')
                    if (cb) return cb.getIn(['arithmetic_conditions', 'operation'])
                }
                return undefined
            },

            getArea(pos?: IPoint) {
                return new Area({
                    x: pos ? pos.x : this.position.x,
                    y: pos ? pos.y : this.position.y,
                    width: this.size.x,
                    height: this.size.y
                }, true)
            },

            change(name: string, direction: number) {
                BP.operation(this.entity_number, 'Changed Entity', entities => (
                    entities.withMutations(map => {
                        map.setIn([this.entity_number, 'name'], name)
                        map.setIn([this.entity_number, 'direction'], direction)
                    })
                ))
            },

            move(pos: IPoint) {
                const entity = BP.entity(this.entity_number)
                if (!BP.entityPositionGrid.checkNoOverlap(entity.name, entity.direction, pos)) return false
                BP.operation(this.entity_number, 'Moved entity',
                    entities => entities.setIn([this.entity_number, 'position'], Immutable.fromJS(pos)),
                    'mov'
                )
                BP.entityPositionGrid.setTileData(this.entity_number)
                return true
            },

            rotate(notMoving: boolean, offset?: IPoint, pushToHistory = true, otherEntity?: number) {
                if (!this.assemblerCraftsWithFluid &&
                    (this.name === 'assembling-machine-2' || this.name === 'assembling-machine-3')) return false
                if (notMoving && BP.entityPositionGrid.sharesCell(this.getArea())) return false
                const pr = this.entityData.possible_rotations
                if (!pr) return false
                const newDir = pr[(pr.indexOf(this.direction) +
                    (notMoving && (this.size.x !== this.size.y || this.type === 'underground-belt') ? 2 : 1)
                    ) % pr.length
                ]
                if (newDir === this.direction) return false
                BP.operation(otherEntity ? [this.entity_number, otherEntity] : this.entity_number, 'Rotated entity',
                    entities => entities.withMutations(map => {
                        map.setIn([this.entity_number, 'direction'], newDir)
                        if (notMoving && this.type === 'underground-belt') {
                            map.updateIn([this.entity_number, 'type'], directionType =>
                                directionType === 'input' ? 'output' : 'input'
                            )
                        }
                        if (!notMoving && this.size.x !== this.size.y) {
                            // tslint:disable-next-line:no-parameter-reassignment
                            map.updateIn([this.entity_number, 'position', 'x'], x => x += offset.x)
                            // tslint:disable-next-line:no-parameter-reassignment
                            map.updateIn([this.entity_number, 'position', 'y'], y => y += offset.y)
                        }
                    }),
                    'upd',
                    notMoving && pushToHistory
                )
                return true
            },

            topLeft() {
                return { x: this.position.x - (this.size.x / 2), y: this.position.y - (this.size.y / 2) }
            },
            topRight() {
                return { x: this.position.x + (this.size.x / 2), y: this.position.y - (this.size.y / 2) }
            },
            bottomLeft() {
                return { x: this.position.x - (this.size.x / 2), y: this.position.y + (this.size.y / 2) }
            },
            bottomRight() {
                return { x: this.position.x + (this.size.x / 2), y: this.position.y + (this.size.y / 2) }
            },

            get assemblerCraftsWithFluid() {
                return this.recipe &&
                    factorioData.getRecipe(this.recipe).category === 'crafting-with-fluid' &&
                    this.entityData.crafting_categories &&
                    this.entityData.crafting_categories.includes('crafting-with-fluid')
            },

            get assemblerPipeDirection() {
                if (!this.recipe) return
                const recipeData = factorioData.getRecipe(this.recipe)
                const rD = recipeData.normal ? recipeData.normal : recipeData
                for (const io of rD.ingredients) {
                    if (io.type === 'fluid') {
                        return 'input'
                    }
                }
                if (rD.results) {
                    for (const io of rD.results) {
                        if (io.type === 'fluid') {
                            return 'output'
                        }
                    }
                }
            },

            getWireConnectionPoint(color: string, side: number) {
                const e = this.entityData
                // poles
                if (e.connection_points) return e.connection_points[this.direction / 2].wire[color]
                // combinators
                if (e.input_connection_points) {
                    if (side === 1) return e.input_connection_points[this.direction / 2].wire[color]
                    return e.output_connection_points[this.direction / 2].wire[color]
                }
                if (e.circuit_wire_connection_point) return e.circuit_wire_connection_point.wire[color]

                if (this.type === 'transport-belt') {
                    return e.circuit_wire_connection_points[
                        factorioData.getBeltConnections2(BP, this.position, this.direction) * 4
                    ].wire[color]
                }
                if (e.circuit_wire_connection_points.length === 8) {
                    return e.circuit_wire_connection_points[this.direction].wire[color]
                }
                if (this.name === 'constant-combinator') {
                    return e.circuit_wire_connection_points[this.direction / 2].wire[color]
                }
                return e.circuit_wire_connection_points[this.direction / 2].wire[color]
            },

            toJS() {
                return rawEntity.toJS()
            }
        }
    }
}
