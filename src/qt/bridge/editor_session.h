/**
 * Qt adapter over ArtCade::EditorCore::EditorCoordinator.
 * QML sends IDs/intents only â€” no ProjectDocument copy in QML.
 */
#pragma once

#include "bridge/assets_model.h"
#include "bridge/console_model.h"
#include "bridge/hierarchy_model.h"
#include "bridge/layers_model.h"
#include "bridge/logic_catalog_model.h"
#include "bridge/variables_model.h"

#include <QObject>
#include <QString>
#include <QStringList>
#include <QVariant>
#include <QtQml/qqmlregistration.h>
#include <memory>

class QJSEngine;
class QPainter;
class QQmlEngine;
class SceneViewItem;
class PlayProcessHost;

namespace ArtCade::EditorCore {
class EditorCoordinator;
struct LogicRuleBlockAddress;
}

class EditorSession : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    Q_PROPERTY(QString projectName READ projectName NOTIFY projectNameChanged)
    Q_PROPERTY(bool dirty READ isDirty NOTIFY dirtyChanged)
    Q_PROPERTY(bool playing READ isPlaying NOTIFY playingChanged)
    Q_PROPERTY(QString activeMode READ activeMode WRITE setActiveMode NOTIFY activeModeChanged)
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusMessageChanged)
    Q_PROPERTY(HierarchyModel *hierarchyModel READ hierarchyModel CONSTANT)
    Q_PROPERTY(LayersModel *layersModel READ layersModel CONSTANT)
    Q_PROPERTY(VariablesModel *variablesModel READ variablesModel CONSTANT)
    Q_PROPERTY(AssetsModel *assetsModel READ assetsModel CONSTANT)
    Q_PROPERTY(ConsoleModel *consoleModel READ consoleModel CONSTANT)
    Q_PROPERTY(LogicCatalogModel *logicCatalogModel READ logicCatalogModel CONSTANT)
    Q_PROPERTY(bool hasProject READ hasProject NOTIFY hasProjectChanged)
    /** True when built with ARTCADE_DEV_TOOLS (Load Fixture, tech console logs). */
    Q_PROPERTY(bool developerMode READ developerMode CONSTANT)
    /** Scene count in the open ProjectDoc (0 when no project). */
    Q_PROPERTY(int sceneCount READ sceneCount NOTIFY projectChanged)
    /** Instance count in the active scene (0 when no project / empty scene). */
    Q_PROPERTY(int activeSceneInstanceCount READ activeSceneInstanceCount NOTIFY projectChanged)
    /**
     * Recent project entries: [{ path, name }]. Workspace preference (QSettings),
     * not ProjectDoc data.
     */
    Q_PROPERTY(QVariantList recentProjects READ recentProjects NOTIFY recentProjectsChanged)
    Q_PROPERTY(quint32 selectedEntityId READ selectedEntityId NOTIFY selectionChanged)
    Q_PROPERTY(QString selectedName READ selectedName NOTIFY selectionChanged)
    Q_PROPERTY(double selectedX READ selectedX NOTIFY selectionChanged)
    Q_PROPERTY(double selectedY READ selectedY NOTIFY selectionChanged)
    Q_PROPERTY(double selectedScaleX READ selectedScaleX NOTIFY selectedTransformChanged)
    Q_PROPERTY(double selectedScaleY READ selectedScaleY NOTIFY selectedTransformChanged)
    Q_PROPERTY(double selectedRotationDeg READ selectedRotationDeg NOTIFY selectedTransformChanged)
    Q_PROPERTY(bool hasSelection READ hasSelection NOTIFY selectionChanged)
    /** Derived from selection â†’ SceneInstanceDef.objectTypeId (workspace, not a second authority). */
    Q_PROPERTY(QString selectedObjectTypeId READ selectedObjectTypeId NOTIFY selectionChanged)
    Q_PROPERTY(QString selectedObjectTypeName READ selectedObjectTypeName NOTIFY selectionChanged)
    /** Derived from selection â†’ SceneInstanceDef.layerId (workspace cache). */
    Q_PROPERTY(QString selectedLayerId READ selectedLayerId NOTIFY selectionChanged)
    /** Rule count on objectTypes[typeId].logicBoard; 0 until boards are authored/loaded. */
    Q_PROPERTY(int logicRuleCount READ logicRuleCount NOTIFY logicRulesChanged)
    /**
     * Per-rule summaries for the selected type's board, in execution order.
     * Each entry: { id, name, displayName, enabled, triggerTypeId, triggerDescription,
     *               conditionTypeIds, actionTypeIds,
     *               triggerProperties, conditionClauses, actionProperties }.
     * conditionClauses: [{ index, typeId, displayName, description, properties }].
     * Property rows: { key, kind, value, valueLabel, choices } for
     * Bool/Integer/Number/String/Key/Vec2/Asset/Variable; choices ({value,label}) are
     * project-backed pickers (assets, clips, object types, variables), empty = free-form.
     * Diagnostics per rule (Authoring-mode validateBoard): errorCount,
     * warningCount, diagnostics [{severity, message}].
     */
    Q_PROPERTY(QVariantList logicRules READ logicRules NOTIFY logicRulesChanged)
    /**
     * Display sections on the selected type's board, in board order:
     * [{ id, name }]. Grouping metadata only â€” never affects execution order.
     */
    Q_PROPERTY(QVariantList logicSections READ logicSections NOTIFY logicRulesChanged)
    /** Workspace: which rule is focused in Logic Board (does not dirty). */
    Q_PROPERTY(QString selectedLogicRuleId READ selectedLogicRuleId WRITE setSelectedLogicRuleId
                   NOTIFY selectedLogicRuleChanged)
    Q_PROPERTY(QString activeLayerId READ activeLayerId NOTIFY activeLayerChanged)
    Q_PROPERTY(QString activeSceneName READ activeSceneName NOTIFY projectChanged)
    Q_PROPERTY(double activeSceneWidth READ activeSceneWidth NOTIFY projectChanged)
    Q_PROPERTY(double activeSceneHeight READ activeSceneHeight NOTIFY projectChanged)
    Q_PROPERTY(double worldGravity READ worldGravity NOTIFY projectChanged)
    Q_PROPERTY(double worldPixelsPerMeter READ worldPixelsPerMeter NOTIFY projectChanged)
    /** Workspace: scene interaction tool â€” select | pan | rect (does not dirty). */
    Q_PROPERTY(QString activeTool READ activeTool WRITE setActiveTool NOTIFY activeToolChanged)
    /** Workspace: snap Select-drag commits to scene grid (does not dirty). */
    Q_PROPERTY(bool snapEnabled READ snapEnabled WRITE setSnapEnabled NOTIFY snapEnabledChanged)
    /** Workspace: selected asset id in Assets dock (does not dirty). */
    Q_PROPERTY(QString selectedAssetId READ selectedAssetId WRITE setSelectedAssetId
                   NOTIFY selectedAssetChanged)
    Q_PROPERTY(QString selectedAssetName READ selectedAssetName NOTIFY selectedAssetChanged)
    Q_PROPERTY(QString selectedAssetKind READ selectedAssetKind NOTIFY selectedAssetChanged)
    Q_PROPERTY(QString selectedAssetPath READ selectedAssetPath NOTIFY selectedAssetChanged)
    Q_PROPERTY(bool hasAssetSelection READ hasAssetSelection NOTIFY selectedAssetChanged)
    /** Workspace: Console panel collapsed (does not dirty). Default true for session. */
    Q_PROPERTY(bool consoleCollapsed READ consoleCollapsed WRITE setConsoleCollapsed
                   NOTIFY consoleCollapsedChanged)

public:
    explicit EditorSession(QObject *parent = nullptr);
    ~EditorSession() override;

    static EditorSession *create(QQmlEngine *engine, QJSEngine *scriptEngine);

    [[nodiscard]] QString projectName() const;
    [[nodiscard]] bool isDirty() const;
    [[nodiscard]] bool isPlaying() const;
    [[nodiscard]] QString activeMode() const;
    [[nodiscard]] QString statusMessage() const;
    [[nodiscard]] HierarchyModel *hierarchyModel() const;
    [[nodiscard]] LayersModel *layersModel() const;
    [[nodiscard]] VariablesModel *variablesModel() const;
    [[nodiscard]] AssetsModel *assetsModel() const;
    [[nodiscard]] ConsoleModel *consoleModel() const;
    [[nodiscard]] LogicCatalogModel *logicCatalogModel() const;
    [[nodiscard]] bool hasProject() const;
    [[nodiscard]] bool developerMode() const;
    [[nodiscard]] int sceneCount() const;
    [[nodiscard]] int activeSceneInstanceCount() const;
    [[nodiscard]] QVariantList recentProjects() const;
    [[nodiscard]] quint32 selectedEntityId() const;
    [[nodiscard]] QString selectedName() const;
    [[nodiscard]] double selectedX() const;
    [[nodiscard]] double selectedY() const;
    [[nodiscard]] double selectedScaleX() const;
    [[nodiscard]] double selectedScaleY() const;
    [[nodiscard]] double selectedRotationDeg() const;
    [[nodiscard]] bool hasSelection() const;
    [[nodiscard]] QString selectedObjectTypeId() const;
    [[nodiscard]] QString selectedObjectTypeName() const;
    [[nodiscard]] QString selectedLayerId() const;
    [[nodiscard]] int logicRuleCount() const;
    [[nodiscard]] QVariantList logicRules() const;
    [[nodiscard]] QVariantList logicSections() const;
    [[nodiscard]] QString selectedLogicRuleId() const;
    void setSelectedLogicRuleId(const QString &ruleId);
    [[nodiscard]] QString activeLayerId() const;
    [[nodiscard]] QString activeSceneName() const;
    [[nodiscard]] double activeSceneWidth() const;
    [[nodiscard]] double activeSceneHeight() const;
    [[nodiscard]] double worldGravity() const;
    [[nodiscard]] double worldPixelsPerMeter() const;
    [[nodiscard]] QString activeTool() const;
    [[nodiscard]] bool snapEnabled() const;
    [[nodiscard]] QString selectedAssetId() const;
    [[nodiscard]] QString selectedAssetName() const;
    [[nodiscard]] QString selectedAssetKind() const;
    [[nodiscard]] QString selectedAssetPath() const;
    [[nodiscard]] bool hasAssetSelection() const;
    [[nodiscard]] bool consoleCollapsed() const;

    void setActiveMode(const QString &mode);
    void setActiveTool(const QString &tool);
    void setSnapEnabled(bool enabled);
    void setSelectedAssetId(const QString &assetId);
    void setConsoleCollapsed(bool collapsed);

    Q_INVOKABLE void openProject(const QString &pathOrUrl);
    /**
     * Creates a new empty project at @p pathOrUrl (Save dialog path) and opens it.
     * @p projectName may be empty â€” derived from the file stem.
     */
    Q_INVOKABLE void createProject(const QString &pathOrUrl, const QString &projectName = QString());
    /** Opens the W2 slice fixture. No-ops unless developerMode is enabled. */
    Q_INVOKABLE void openSliceFixture();
    [[nodiscard]] Q_INVOKABLE QString sliceFixturePath() const;
    Q_INVOKABLE void clearRecentProjects();
    /**
     * Returns true if the window may close now.
     * If dirty, emits closeBlockedByDirty so QML can show Save/Discard/Cancel.
     */
    Q_INVOKABLE bool requestClose();
    Q_INVOKABLE void discardAndClose();
    Q_INVOKABLE void undo();
    Q_INVOKABLE void redo();
    Q_INVOKABLE void saveProject();
    Q_INVOKABLE void selectEntity(quint32 entityId);
    Q_INVOKABLE void clearSelection();
    Q_INVOKABLE void commitRename(const QString &newName);
    /**
     * Commits position for @p entityId only if it is still the selected instance
     * (guards mid-edit selection changes).
     */
    Q_INVOKABLE void commitPosition(quint32 entityId, double x, double y);
    /**
     * Commits a position captured by an in-progress Scene View drag.
     * @p entityId must be the stable instance id captured before the gesture;
     * callers must cancel the gesture when its ProjectDocument changes.
     */
    void commitCapturedScenePosition(quint32 entityId, double x, double y);
    /**
     * Commits scale for @p entityId only if still selected. One undoable command.
     * Scale must be finite and > 0.
     */
    Q_INVOKABLE void commitScale(quint32 entityId, double scaleX, double scaleY);
    /**
     * Commits rotation (degrees UI) for @p entityId only if still selected.
     * Stored as radians in ProjectDoc.
     */
    Q_INVOKABLE void commitRotation(quint32 entityId, double degrees);
    Q_INVOKABLE void setActiveLayer(const QString &layerId);
    /**
     * Workspace-only eye toggle: hides the layer in Scene View.
     * Does not dirty ProjectDoc or touch layerSettings.visible (Play/export).
     */
    Q_INVOKABLE void setLayerHiddenInEditor(const QString &layerId, bool hidden);
    /**
     * Play/export visibility (layerSettings.visible). Prefer setLayerHiddenInEditor for the eye.
     */
    Q_INVOKABLE void setLayerVisible(const QString &layerId, bool visible);
    /** Persistent SceneLayerDef.locked (undoable). */
    Q_INVOKABLE void setLayerLocked(const QString &layerId, bool locked);
    /** Adds a layer to the active scene (undoable). Activates the new layer. */
    Q_INVOKABLE void addSceneLayer();
    /** Adds a project global variable (undoable). typeId: number|boolean|string. */
    Q_INVOKABLE bool addGameVariable(const QString &key, const QString &typeId);
    /** Removes an unreferenced project global by immutable key (undoable). */
    Q_INVOKABLE bool removeGameVariable(const QString &key);
    /** Changes an unreferenced global's type and resets its initial value (undoable). */
    Q_INVOKABLE bool setGameVariableType(const QString &key, const QString &typeId);
    /** Sets a finite Number initial value (undoable; same value is a no-op). */
    Q_INVOKABLE bool setGameVariableInitialNumber(const QString &key, double value);
    /** Sets a Boolean initial value (undoable; same value is a no-op). */
    Q_INVOKABLE bool setGameVariableInitialBoolean(const QString &key, bool value);
    /** Sets a String initial value (undoable; same value is a no-op). */
    Q_INVOKABLE bool setGameVariableInitialString(const QString &key, const QString &value);
    /** Sets authoring-only description text (undoable; same value is a no-op). */
    Q_INVOKABLE bool setGameVariableDescription(const QString &key, const QString &description);
    /** Suggests an unused key like variable1 for Add Variable. */
    Q_INVOKABLE QString suggestNextGameVariableKey() const;
    /** How many Logic Board properties reference this variable key. */
    Q_INVOKABLE int gameVariableLogicReferenceCount(const QString &key) const;
    /** Renames a layer in the active scene (undoable). Returns false on validation failure. */
    Q_INVOKABLE bool renameSceneLayer(const QString &layerId, const QString &newName);
    /** Sets the active scene's default layer (undoable). */
    Q_INVOKABLE void setDefaultSceneLayer(const QString &layerId);
    /**
     * Moves a layer in the active scene to @p targetIndex
     * (0 = background / top of list, last = foreground / bottom). Undoable.
     */
    Q_INVOKABLE void moveSceneLayer(const QString &layerId, int targetIndex);
    /**
     * Assigns instance @p entityId to @p layerId in its owning scene. Undoable.
     * Target is the stable entity id (not the current selection).
     */
    Q_INVOKABLE void setEntityLayer(quint32 entityId, const QString &layerId);
    /**
     * Removes a layer from the active scene, transferring instances to @p transferLayerId.
     * Undoable. Fails for the default layer or the last remaining layer.
     */
    Q_INVOKABLE void removeSceneLayer(const QString &layerId, const QString &transferLayerId);
    /** Duplicates a layer and its instances in the active scene (undoable). */
    Q_INVOKABLE void duplicateSceneLayer(const QString &layerId);
    /** Instance count on @p layerId in the active scene (delete dialog). */
    [[nodiscard]] Q_INVOKABLE int countInstancesOnLayer(const QString &layerId) const;
    /**
     * Other layers in the active scene suitable as delete-transfer targets.
     * Prefer default layer first. Each entry: { layerId, display }.
     */
    [[nodiscard]] Q_INVOKABLE QVariantList layerTransferChoices(const QString &exceptLayerId) const;
    /**
     * Appends a default When/Then rule on the selected instance's object type.
     * Dirties ProjectDoc; undoable.
     */
    Q_INVOKABLE void addLogicRule();
    /**
     * Removes Logic rule @p ruleId from the selected instance's object type.
     * Dirties ProjectDoc; undoable.
     */
    Q_INVOKABLE void removeLogicRule(const QString &ruleId);
    /**
     * Renames a Logic rule authoring label. Returns false and reports the validation error on failure.
     */
    Q_INVOKABLE bool renameLogicRule(const QString &ruleId, const QString &name);
    /** Sets When trigger block type on @p ruleId. */
    Q_INVOKABLE void setLogicRuleTrigger(const QString &ruleId, const QString &blockTypeId);
    /** Sets primary Then action block type on @p ruleId. */
    Q_INVOKABLE void setLogicRulePrimaryAction(const QString &ruleId, const QString &blockTypeId);
    Q_INVOKABLE void addLogicCondition(const QString &ruleId, const QString &blockTypeId);
    Q_INVOKABLE void setLogicConditionAt(const QString &ruleId,
                                         int index,
                                         const QString &blockTypeId);
    Q_INVOKABLE void removeLogicConditionAt(const QString &ruleId, int index);
    Q_INVOKABLE void moveLogicCondition(const QString &ruleId, int from, int to);
    Q_INVOKABLE void setLogicConditionProperty(const QString &ruleId,
                                               int index,
                                               const QString &propertyKey,
                                               const QString &valueText);
    /**
     * Enables/disables Logic rule @p ruleId on the selected type.
     * Disabled rules persist but are skipped by compile/Play. Undoable.
     */
    Q_INVOKABLE void setLogicRuleEnabled(const QString &ruleId, bool enabled);
    /** Adds a display section ("Section N") on the selected type's board. Undoable. */
    Q_INVOKABLE void addLogicSection();
    /** Renames display section @p sectionId (empty names rejected). Undoable. */
    Q_INVOKABLE void renameLogicSection(const QString &sectionId, const QString &name);
    /** Removes section @p sectionId; its rules become unsectioned. Undoable. */
    Q_INVOKABLE void removeLogicSection(const QString &sectionId);
    /** Assigns rule @p ruleId to @p sectionId ("" = unsectioned). Undoable. */
    Q_INVOKABLE void setLogicRuleSection(const QString &ruleId, const QString &sectionId);
    /**
     * Sets a property on a primary block of @p ruleId.
     * @p slot is "trigger" | "action" (use setLogicConditionProperty for conditions).
     * @p valueText is kind-specific ("true", "Space", "1.0", …). Undoable.
     */
    Q_INVOKABLE void setLogicRuleBlockProperty(const QString &ruleId,
                                               const QString &slot,
                                               const QString &propertyKey,
                                               const QString &valueText);
    /**
     * Surfaces an authoring error in the status bar and via errorOccurred.
     * Used when QML must abort an apply without a coordinator command (e.g. catalog race).
     */
    Q_INVOKABLE void notifyAuthoringError(const QString &message);
    /**
     * Ensures the selected Object Type owns a Logic-required component.
     * @p componentId is "platformerController" or "spriteAnimator".
     * Returns false on failure; no-op when already present.
     */
    Q_INVOKABLE bool ensureObjectTypeComponent(const QString &componentId);
    [[nodiscard]] Q_INVOKABLE QString logicBlockDisplayName(const QString &blockTypeId) const;
    /**
     * Maps a Qt key code to a Logic key name ("Space", "W", â€¦), or empty if unsupported.
     * Used by the Logic Board key detector (single source with logicKeyFromName).
     */
    [[nodiscard]] Q_INVOKABLE QString logicKeyFromQtKey(int qtKey) const;
    Q_INVOKABLE quint32 pickEntityAt(double worldX, double worldY);
    /**
     * Selects the topmost instance whose placeholder AABB intersects the world rect.
     * Clears selection when none hit. Workspace-only (no dirty).
     */
    Q_INVOKABLE void selectInWorldRect(double x0, double y0, double x1, double y1);
    /** Grid step used for snap + scene grid paint (matches placeholder extent). */
    [[nodiscard]] Q_INVOKABLE double sceneGridStep() const;
    Q_INVOKABLE void startPlay();
    Q_INVOKABLE void stopPlay();

    /** Paints active-scene placeholders into @p view (called from SceneViewItem::paint). */
    void paintSceneView(QPainter *painter, const SceneViewItem *view) const;
    /** Fits @p view pan/zoom to the active scene world size. */
    void fitSceneView(SceneViewItem *view) const;

signals:
    void projectNameChanged();
    void dirtyChanged();
    void playingChanged();
    void activeModeChanged();
    void statusMessageChanged();
    void hasProjectChanged();
    void recentProjectsChanged();
    void selectionChanged();
    /** Emitted when any projected Transform field changes (position/scale/rotation). */
    void selectedTransformChanged();
    void selectedLogicRuleChanged();
    void logicRulesChanged();
    void activeLayerChanged();
    void projectChanged();
    void activeToolChanged();
    void snapEnabledChanged();
    void selectedAssetChanged();
    void consoleCollapsedChanged();
    void errorOccurred(const QString &message);
    void closeBlockedByDirty();
    void closeAccepted();

private:
    void commitPositionById(quint32 entityId, double x, double y);
    void setStatus(const QString &message, bool logToConsole = true);
    [[nodiscard]] bool guardAuthoring(QString *errorOut = nullptr) const;
    void emitProjectSignals();
    void refreshSelectionCache();
    void setLogicRuleBlockPropertyAddressed(
        const QString &ruleId,
        ArtCade::EditorCore::LogicRuleBlockAddress address,
        const QString &propertyKey,
        const QString &valueText);
    void reloadDerivedModels();
    void refreshProjectCounts();
    void refreshAssetSelectionCache();
    void clearAssetSelection();
    void rememberRecentProject(const QString &path, const QString &name);
    void onPlayProcessStopped(int exit_code, const QString &status_message);
    [[nodiscard]] QString normalizePath(const QString &pathOrUrl) const;
    [[nodiscard]] QString resolveGameExecutable() const;
    [[nodiscard]] QString projectDirectory() const;

    std::unique_ptr<ArtCade::EditorCore::EditorCoordinator> m_coordinator;
    HierarchyModel *m_hierarchy = nullptr;
    LayersModel *m_layers = nullptr;
    VariablesModel *m_variables = nullptr;
    AssetsModel *m_assets = nullptr;
    ConsoleModel *m_console = nullptr;
    LogicCatalogModel *m_logicCatalog = nullptr;
    PlayProcessHost *m_play = nullptr;
    QString m_activeMode;
    QString m_statusMessage;
    bool m_playing = false;
    QString m_activeTool{QStringLiteral("select")};
    bool m_snap_enabled = false;
    QString m_selectedName;
    double m_selectedX = 0.0;
    double m_selectedY = 0.0;
    double m_selectedScaleX = 1.0;
    double m_selectedScaleY = 1.0;
    double m_selectedRotationDeg = 0.0;
    QString m_selectedObjectTypeId;
    QString m_selectedObjectTypeName;
    QString m_selectedLayerId;
    int m_logicRuleCount = 0;
    int m_sceneCount = 0;
    int m_activeSceneInstanceCount = 0;
    QVariantList m_recentProjects;
    QStringList m_logicRuleIds;
    QVariantList m_logicRules;
    QVariantList m_logicSections;
    QString m_selectedLogicRuleId;
    QString m_selectedAssetId;
    QString m_selectedAssetName;
    QString m_selectedAssetKind;
    QString m_selectedAssetPath;
    bool m_consoleCollapsed = true;
};
