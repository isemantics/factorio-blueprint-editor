import G from '../globals'
import factorioData from '../factorio-data/factorioData'
import { updateGroups } from '../updateGroups'
import { isNumber } from 'util'
import { EntitySprite } from '../entitySprite'
import { UnderlayContainer } from './underlay'

export class EntityContainer extends PIXI.Container {
    static mappings: Map<number, EntityContainer> = new Map()

    static getGridPosition(containerPosition: IPoint) {
        return {
            x: Math.round(containerPosition.x / 32 * 10) / 10,
            y: Math.round(containerPosition.y / 32 * 10) / 10
        }
    }

    static getPositionFromData(currentPos: IPoint, size: IPoint) {
        const res = { x: 0, y: 0 }
        if (size.x % 2 === 0) {
            const npx = currentPos.x - currentPos.x % 16
            res.x = npx + (npx % 32 === 0 ? 0 : 16)
        } else {
            res.x = currentPos.x - currentPos.x % 32 + 16
        }
        if (size.y % 2 === 0) {
            const npy = currentPos.y - currentPos.y % 16
            res.y = npy + (npy % 32 === 0 ? 0 : 16)
        } else {
            res.y = currentPos.y - currentPos.y % 32 + 16
        }
        return res
    }

    static isContainerOutOfBpArea(newPos: IPoint, size: IPoint) {
        return newPos.x - size.x / 2 < 0 ||
            newPos.y - size.y / 2 < 0 ||
            newPos.x + size.x / 2 > G.bpArea.width ||
            newPos.y + size.y / 2 > G.bpArea.height
    }

    static getParts(entity: any, hr: boolean, ignore_connections?: boolean): EntitySprite[] {
        const anims = factorioData.getSpriteData(entity, hr, ignore_connections ? undefined : G.bp)

        // const icon = new PIXI.Sprite(G.iconSprites['icon:' + factorioData.getEntity(entity.name).icon.split(':')[1]])
        // icon.x -= 16
        // icon.y -= 16
        // return [icon]

        const parts: EntitySprite[] = []
        for (let i = 0, l = anims.length; i < l; i++) {
            const img = new EntitySprite(anims[i])

            if (entity.name === 'straight-rail' || entity.name === 'curved-rail') {
                if (i < 2) {
                    img.zIndex = -10
                } else if (i < 4) {
                    img.zIndex = -9
                } else {
                    img.zIndex = -8
                }
            } else if (entity.type === 'transport-belt' || entity.name === 'heat-pipe') {
                img.zIndex = i === 0 ? -7 : -6
            } else {
                img.zIndex = 0
            }
            img.zOrder = i

            parts.push(img)
        }

        return parts
    }

    entity_number: number
    areaVisualization: PIXI.Sprite | PIXI.Sprite[] | undefined
    entityInfo: PIXI.Container
    entitySprites: EntitySprite[]

    constructor(entity_number: number, sort = true) {
        super()
        this.entity_number = entity_number

        EntityContainer.mappings.set(entity_number, this)

        const entity = G.bp.entity(entity_number)
        this.position.set(
            entity.position.x * 32,
            entity.position.y * 32
        )

        this.interactive = true
        this.interactiveChildren = false
        this.buttonMode = true

        this.entitySprites = []

        this.areaVisualization = G.BPC.underlayContainer.createNewArea(entity.name, this.position)
        this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.entity_number, this.position)

        this.on('pointerdown', this.pointerDownEventHandler)
        // this.on('pointermove', this.pointerMoveEventHandler)
        this.on('pointerover', this.pointerOverEventHandler)
        this.on('pointerout', this.pointerOutEventHandler)

        this.redraw(false, sort)
    }

    destroy() {
        if (G.editEntityContainer.visible) G.editEntityContainer.close()

        for (const s of this.entitySprites) s.destroy()

        super.destroy()
        EntityContainer.mappings.delete(this.entity_number)

        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.destroy())
        G.BPC.overlayContainer.hideCursorBox()
        G.BPC.overlayContainer.hideUndergroundLines()

        if (this.entityInfo) this.entityInfo.destroy()
    }

    checkBuildable() {
        const position = EntityContainer.getGridPosition(this.position)
        const entity = G.bp.entity(this.entity_number)
        if (!EntityContainer.isContainerOutOfBpArea(position, entity.size) &&
            G.bp.entityPositionGrid.checkNoOverlap(entity.name, entity.direction, position)
        ) {
            G.BPC.movingEntityFilter.red = 0.4
            G.BPC.movingEntityFilter.green = 1
        } else {
            G.BPC.movingEntityFilter.red = 1
            G.BPC.movingEntityFilter.green = 0.4
        }
    }

    rotate() {
        const offset = {
            x: (this.x / 16 - G.gridCoords16.x) === 0 ? 0.5 : -0.5,
            y: (this.y / 16 - G.gridCoords16.y) === 0 ? 0.5 : -0.5
        }
        const entity = G.bp.entity(this.entity_number)
        let otherEntity
        if (G.currentMouseState === G.mouseStates.NONE && entity.type === 'underground-belt') {
            otherEntity = G.bp.entityPositionGrid.findEntityWithSameNameAndDirection(
                entity.name, entity.direction, entity.position,
                entity.directionType === 'input' ? entity.direction : (entity.direction + 4) % 8,
                entity.entityData.max_distance
            )
            if (isNumber(otherEntity)) {
                const oe = G.bp.entity(otherEntity)
                if (oe.directionType === entity.directionType) {
                    otherEntity = undefined
                } else {
                    oe.rotate(G.currentMouseState === G.mouseStates.NONE, { x: 0, y: 0 }, false)
                    EntityContainer.mappings.get(otherEntity).redraw()
                }
            }
        }

        if (G.bp.entity(this.entity_number).rotate(G.currentMouseState === G.mouseStates.NONE, offset, true, otherEntity)) {
            const entity = G.bp.entity(this.entity_number)
            if (G.currentMouseState === G.mouseStates.MOVING && entity.size.x !== entity.size.y) {
                this.x += offset.x * 32
                this.y += offset.y * 32
                const pos = EntityContainer.getPositionFromData(this.position, entity.size)
                this.position.set(pos.x, pos.y)

                G.BPC.overlayContainer.updateCursorBoxPosition(this.position)
            }

            this.redraw(G.currentMouseState === G.mouseStates.MOVING)
            if (G.currentMouseState === G.mouseStates.NONE) this.redrawSurroundingEntities()

            G.BPC.overlayContainer.updateCursorBoxSize(entity.size.x, entity.size.y)
            this.updateUndergroundLines()

            if (G.BPC.movingContainer === this) this.checkBuildable()

            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.entity_number)
        }
    }

    updateUndergroundLines() {
        const entity = G.bp.entity(this.entity_number)
        G.BPC.overlayContainer.updateUndergroundLines(
            entity.name,
            { x: this.position.x / 32, y: this.position.y / 32 },
            entity.direction,
            entity.directionType === 'output' || entity.name === 'pipe-to-ground' ? (entity.direction + 4) % 8 : entity.direction
        )
    }

    pointerDownEventHandler(e: PIXI.interaction.InteractionEvent) {
        console.log(G.bp.entity(this.entity_number).toJS())
        if (e.data.button === 0) {
            if (G.currentMouseState === G.mouseStates.NONE && !G.openedGUIWindow && !G.keyboard.shift) {
                G.editEntityContainer.create(this.entity_number)
            }
            if (G.keyboard.shift) this.pasteData()
        } else if (e.data.button === 1) {
            if (this !== G.BPC.movingContainer && G.currentMouseState === G.mouseStates.NONE) {
                G.bp.entityPositionGrid.removeTileData(this.entity_number, false)
                this.redraw(true)
                this.redrawSurroundingEntities()
                G.BPC.movingContainer = this
                G.currentMouseState = G.mouseStates.MOVING

                // Move container to cursor
                const newPosition = e.data.getLocalPosition(this.parent)
                const pos = EntityContainer.getPositionFromData(newPosition, G.bp.entity(this.entity_number).size)

                if (this.position.x !== pos.x || this.position.y !== pos.y) {
                    this.position.set(pos.x, pos.y)
                    this.updateVisualStuff()
                }

                G.gridCoords16 = {
                    x: (newPosition.x - newPosition.x % 16) / 16,
                    y: (newPosition.y - newPosition.y % 16) / 16
                }

                for (const s of this.entitySprites) s.moving = true
                G.BPC.sortEntities()
                G.BPC.underlayContainer.activateRelatedAreas(G.bp.entity(this.entity_number).name)

                G.BPC.updateOverlay()
                return
            }
            if (this === G.BPC.movingContainer && G.currentMouseState === G.mouseStates.MOVING) {
                this.placeEntityContainerDown()
            }
        } else if (e.data.button === 2 && G.currentMouseState === G.mouseStates.NONE) {
            if (G.keyboard.shift) {
                G.copyData.recipe = G.bp.entity(this.entity_number).recipe
                G.copyData.modules = G.bp.entity(this.entity_number).modulesList
            } else {
                G.BPC.holdingRightClick = true
                this.removeContainer()
            }
        }
    }

    changeRecipe(recipeName: string) {
        const entity = G.bp.entity(this.entity_number)
        entity.recipe = recipeName
        this.redrawEntityInfo()
        if (entity.name === 'chemical-plant' || entity.assemblerCraftsWithFluid || G.bp.entity(this.entity_number).assemblerCraftsWithFluid) {
            this.redraw()
            this.redrawSurroundingEntities()
        }
    }

    pasteData() {
        const entity = G.bp.entity(this.entity_number)

        const aR = entity.acceptedRecipes
        const RECIPE = G.copyData.recipe && aR && aR.includes(G.copyData.recipe) ? G.copyData.recipe : undefined

        const aM = entity.acceptedModules
        if (aM && G.copyData.modules && G.copyData.modules.length !== 0) {
            const filteredModules = []
            for (const m of G.copyData.modules) {
                if (aM.includes(m)) filteredModules.push(m)
            }
            const maxSlots = entity.entityData.module_specification.module_slots
            entity.modulesList = filteredModules.length > maxSlots ? filteredModules.slice(0, maxSlots) : filteredModules
        } else {
            entity.modulesList = []
        }
        if (aM) this.redrawEntityInfo()
        if (entity.recipe !== RECIPE) this.changeRecipe(RECIPE)
    }

    redrawEntityInfo() {
        const entity = G.bp.entity(this.entity_number)
        if (entity.entityData.module_specification || entity.type === 'splitter' ||
            entity.entityData.crafting_categories || entity.type === 'mining-drill' ||
            entity.type === 'boiler' || entity.type === 'generator' ||
            entity.name === 'pump' || entity.name === 'offshore-pump' ||
            entity.name === 'arithmetic-combinator' || entity.name === 'decider-combinator'
        ) {
            if (this.entityInfo) this.entityInfo.destroy()
            this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.entity_number, this.position)
        }
    }

    updateVisualStuff() {
        for (const s of this.entitySprites) s.setPosition(this.position)

        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.position.copy(this.position))

        if (this.entityInfo) this.entityInfo.position = this.position

        G.BPC.overlayContainer.updateCursorBoxPosition(this.position)
        G.BPC.overlayContainer.updateUndergroundLinesPosition(this.position)
        this.updateUndergroundLines()

        G.BPC.wiresContainer.update(this.entity_number)

        this.checkBuildable()
    }

    removeContainer() {
        G.BPC.wiresContainer.remove(this.entity_number)
        G.bp.entityPositionGrid.removeTileData(this.entity_number, false)
        this.redrawSurroundingEntities()
        G.bp.removeEntity(this.entity_number,
            entity_number => EntityContainer.mappings.get(entity_number).redraw()
        )
        G.BPC.hoverContainer = undefined

        G.BPC.updateOverlay()
        this.destroy()
    }

    // pointerMoveEventHandler(e: PIXI.interaction.InteractionEvent) {
    //     this.moveTo(e.data.getLocalPosition(this.parent))
    // }

    moveTo(newPosition: IPoint) {
        if (G.BPC.movingContainer === this && G.currentMouseState === G.mouseStates.MOVING) {
            const newCursorPos = {
                x: (newPosition.x - newPosition.x % 16) / 16,
                y: (newPosition.y - newPosition.y % 16) / 16
            }
            if (newCursorPos.x !== G.gridCoords16.x || newCursorPos.y !== G.gridCoords16.y) {
                const entity = G.bp.entity(this.entity_number)
                switch (entity.name) {
                    case 'straight-rail':
                    case 'curved-rail':
                    case 'train-stop':
                        this.x = newPosition.x - (newPosition.x + G.railMoveOffset.x * 32) % 64 + 32
                        this.y = newPosition.y - (newPosition.y + G.railMoveOffset.y * 32) % 64 + 32
                        break
                    default:
                        const pos = EntityContainer.getPositionFromData(newPosition, entity.size)
                        this.position.set(pos.x, pos.y)
                }

                this.updateVisualStuff()

                G.gridCoords16 = newCursorPos
            }
        }
    }

    pointerOverEventHandler() {
        // Pointer over is sometimes getting called before pointer out
        if (G.BPC.hoverContainer && G.BPC.hoverContainer !== this) G.BPC.hoverContainer.pointerOutEventHandler()
        if (!G.BPC.movingContainer && !G.BPC.paintContainer) {
            G.BPC.hoverContainer = this

            const entity = G.bp.entity(this.entity_number)
            G.BPC.overlayContainer.updateCursorBoxSize(entity.size.x, entity.size.y)
            G.BPC.overlayContainer.updateCursorBoxPosition(this.position)
            G.BPC.overlayContainer.showCursorBox()
            G.BPC.overlayContainer.updateUndergroundLinesPosition(this.position)
            this.updateUndergroundLines()

            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.visible = true)
        }
    }

    pointerOutEventHandler() {
        if (!G.BPC.movingContainer && !G.BPC.paintContainer && G.BPC.hoverContainer === this) {
            G.BPC.hoverContainer = undefined
            G.BPC.overlayContainer.hideCursorBox()
            G.BPC.overlayContainer.hideUndergroundLines()
            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.visible = false)
        }
    }

    placeEntityContainerDown() {
        const entity = G.bp.entity(this.entity_number)
        const position = EntityContainer.getGridPosition(this.position)
        if (EntityContainer.isContainerOutOfBpArea(position, entity.size)) return
        if (G.currentMouseState === G.mouseStates.MOVING && entity.move(position)) {
            G.BPC.movingContainer = undefined
            G.currentMouseState = G.mouseStates.NONE

            for (const s of this.entitySprites) s.moving = false

            this.redraw(false)
            this.redrawSurroundingEntities()

            G.BPC.underlayContainer.deactivateActiveAreas()

            G.BPC.updateOverlay()
        }
    }

    redrawSurroundingEntities() {
        const entity = G.bp.entity(this.entity_number)
        const redrawnEntities: number[] = []
        for (const updateGroup of updateGroups) {
            const j = updateGroup.is.indexOf(entity.name)
            if (j !== -1) {
                if (entity.name === 'straight-rail') {
                    G.bp.entityPositionGrid.foreachOverlap(entity.getArea(), (entnr: number) => {
                        const ent = G.bp.entity(entnr)
                        if (ent.name === 'gate' && !redrawnEntities.includes(entnr)) {
                            EntityContainer.mappings.get(ent.entity_number).redraw()
                            redrawnEntities.push(entnr)
                        }
                    })
                } else {
                    G.bp.entityPositionGrid.getSurroundingEntities(entity.getArea(), (entnr: number) => {
                        const ent = G.bp.entity(entnr)
                        if (updateGroup.updates.includes(ent.name) && !redrawnEntities.includes(entnr)) {
                            EntityContainer.mappings.get(ent.entity_number).redraw()
                            redrawnEntities.push(entnr)
                        }
                    })
                }
            }
        }
    }

    redraw(ignore_connections?: boolean, sort = true) {
        const entity = G.bp.entity(this.entity_number)

        for (const s of this.entitySprites) s.destroy()
        this.entitySprites = []
        for (const s of EntityContainer.getParts(entity, true, ignore_connections)) {
            if (G.BPC.movingContainer === this) s.moving = true
            s.setPosition(this.position)
            this.entitySprites.push(s)
            G.BPC.entitySprites.addChild(s)
        }
        if (sort) G.BPC.sortEntities()

        this.hitArea = new PIXI.Rectangle(
            -entity.size.x * 16,
            -entity.size.y * 16,
            entity.size.x * 32,
            entity.size.y * 32
        )
    }
}
