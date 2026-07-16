#include "bridge/editor_session.h"

#include "bridge/play_process_host.h"
#include "bridge/scene_view_item.h"

#include "artcade/editor_core/editor_core.h"

#include "logic-core.h"

#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QJSEngine>
#include <QFont>
#include <QKeyEvent>
#include <QPainter>
#include <QPen>
#include <QQmlEngine>
#include <QSettings>
#include <QUrl>
#include <QVariantMap>
#include <Qt>
#include <QtGlobal>
#include <algorithm>
#include <cmath>

#ifndef ARTCADE_QT_SLICE_FIXTURE_PATH
#define ARTCADE_QT_SLICE_FIXTURE_PATH ""
#endif

#ifndef ARTCADE_DEV_TOOLS
#define ARTCADE_DEV_TOOLS 0
#endif

namespace {

QColor instance_fill(quint32 entity_id, bool selected)
{
    if (selected) {
        return QColor(79, 142, 232, 200);
    }
    const int hue = static_cast<int>((entity_id * 47u) % 360u);
    return QColor::fromHsv(hue, 110, 170, 150);
}

QVariantMap logic_choice_entry(const std::string &value, const std::string &label)
{
    return QVariantMap{
        {QStringLiteral("value"), QString::fromStdString(value)},
        {QStringLiteral("label"), QString::fromStdString(label.empty() ? value : label)},
    };
}

/**
 * Project-backed choices for one block property (empty when free-form).
 * Values are stable ids; labels are display names only.
 */
QVariantList logic_property_choices(const ArtCade::ProjectDoc &doc,
                                    const ArtCade::LogicBlockDef &block,
                                    const std::string &key)
{
    QVariantList choices;
    if (block.typeId == ArtCade::Logic::kAudioPlaySound && key == "audioAssetId") {
        for (const ArtCade::AudioAssetDef &asset : doc.audioAssets) {
            choices.append(logic_choice_entry(asset.assetId, asset.name));
        }
    } else if (block.typeId == ArtCade::Logic::kAnimationPlayClip
               && key == "animationAssetId") {
        for (const ArtCade::SpriteAnimationAssetDef &asset : doc.spriteAnimationAssets) {
            choices.append(logic_choice_entry(asset.id, asset.name));
        }
    } else if (block.typeId == ArtCade::Logic::kAnimationPlayClip && key == "clipId") {
        const ArtCade::LogicPropertyDef *asset_prop =
            ArtCade::Logic::findProperty(block, "animationAssetId");
        const auto *asset_ref = asset_prop
            ? std::get_if<ArtCade::LogicAssetReference>(&asset_prop->value)
            : nullptr;
        if (asset_ref && !asset_ref->id.empty()) {
            for (const ArtCade::SpriteAnimationAssetDef &asset : doc.spriteAnimationAssets) {
                if (asset.id != asset_ref->id) {
                    continue;
                }
                for (const ArtCade::SpriteAnimationClipDef &clip : asset.clips) {
                    choices.append(logic_choice_entry(clip.id, clip.name));
                }
                break;
            }
        }
    } else if (block.typeId == ArtCade::Logic::kOtherIsObjectType && key == "objectTypeId") {
        for (const auto &[type_id, type] : doc.objectTypes) {
            choices.append(logic_choice_entry(type_id, type.name));
        }
        // objectTypes is unordered — sort by label so the picker is stable.
        std::sort(choices.begin(), choices.end(), [](const QVariant &a, const QVariant &b) {
            return a.toMap().value(QStringLiteral("label")).toString()
                       .localeAwareCompare(
                           b.toMap().value(QStringLiteral("label")).toString()) < 0;
        });
    }
    return choices;
}

QVariantList logic_property_rows(const ArtCade::ProjectDoc &doc,
                                 const ArtCade::LogicBlockDef &block)
{
    QVariantList rows;
    for (const ArtCade::EditorCore::LogicPropertySummary &row :
         ArtCade::EditorCore::logic_block_authorable_properties(block)) {
        const QVariantList choices = logic_property_choices(doc, block, row.key);
        QString value_label = QString::fromStdString(row.value);
        for (const QVariant &entry : choices) {
            const QVariantMap map = entry.toMap();
            if (map.value(QStringLiteral("value")).toString() == value_label) {
                value_label = map.value(QStringLiteral("label")).toString();
                break;
            }
        }
        rows.append(QVariantMap{
            {QStringLiteral("key"), QString::fromStdString(row.key)},
            {QStringLiteral("kind"), QString::fromStdString(row.kind)},
            {QStringLiteral("value"), QString::fromStdString(row.value)},
            {QStringLiteral("valueLabel"), value_label},
            {QStringLiteral("choices"), choices},
        });
    }
    return rows;
}

} // namespace

EditorSession::EditorSession(QObject *parent)
    : QObject(parent)
    , m_coordinator(std::make_unique<ArtCade::EditorCore::EditorCoordinator>())
    , m_hierarchy(new HierarchyModel(this))
    , m_layers(new LayersModel(this))
    , m_assets(new AssetsModel(this))
    , m_console(new ConsoleModel(this))
    , m_play(new PlayProcessHost(this))
    , m_activeMode(QStringLiteral("canvas"))
    , m_statusMessage(QStringLiteral("Create a new project or open an existing one"))
{
    m_hierarchy->setCoordinator(m_coordinator.get());
    m_layers->setCoordinator(m_coordinator.get());
    m_assets->setCoordinator(m_coordinator.get());
    connect(m_play, &PlayProcessHost::stopped, this, &EditorSession::onPlayProcessStopped);

    QSettings settings;
    const QVariantList stored = settings.value(QStringLiteral("recentProjects")).toList();
    for (const QVariant &entry : stored) {
        const QVariantMap map = entry.toMap();
        const QString path = map.value(QStringLiteral("path")).toString();
        if (path.isEmpty() || !QFileInfo::exists(path)) {
            continue;
        }
        QVariantMap row;
        row.insert(QStringLiteral("path"), path);
        row.insert(QStringLiteral("name"),
                   map.value(QStringLiteral("name")).toString().isEmpty()
                       ? QFileInfo(path).completeBaseName()
                       : map.value(QStringLiteral("name")).toString());
        m_recentProjects.append(row);
        if (m_recentProjects.size() >= 8) {
            break;
        }
    }

    if (developerMode() && m_console) {
        m_console->appendInfo(
            QStringLiteral("Developer mode — fixture load and technical logs enabled."));
    }
}

EditorSession::~EditorSession() = default;

EditorSession *EditorSession::create(QQmlEngine *engine, QJSEngine *scriptEngine)
{
    Q_UNUSED(engine);
    Q_UNUSED(scriptEngine);
    return new EditorSession;
}

QString EditorSession::projectName() const
{
    if (!m_coordinator->hasProject()) {
        return QStringLiteral("No project");
    }
    return QString::fromStdString(m_coordinator->document().projectName);
}

bool EditorSession::isDirty() const
{
    return m_coordinator->isDirty();
}

bool EditorSession::isPlaying() const
{
    return m_playing;
}

QString EditorSession::activeMode() const
{
    return m_activeMode;
}

QString EditorSession::statusMessage() const
{
    return m_statusMessage;
}

HierarchyModel *EditorSession::hierarchyModel() const
{
    return m_hierarchy;
}

LayersModel *EditorSession::layersModel() const
{
    return m_layers;
}

AssetsModel *EditorSession::assetsModel() const
{
    return m_assets;
}

ConsoleModel *EditorSession::consoleModel() const
{
    return m_console;
}

bool EditorSession::hasProject() const
{
    return m_coordinator->hasProject();
}

bool EditorSession::developerMode() const
{
    return ARTCADE_DEV_TOOLS != 0;
}

int EditorSession::sceneCount() const
{
    return m_sceneCount;
}

int EditorSession::activeSceneInstanceCount() const
{
    return m_activeSceneInstanceCount;
}

QVariantList EditorSession::recentProjects() const
{
    return m_recentProjects;
}

quint32 EditorSession::selectedEntityId() const
{
    return m_coordinator->selectedEntityId();
}

QString EditorSession::selectedName() const
{
    return m_selectedName;
}

double EditorSession::selectedX() const
{
    return m_selectedX;
}

double EditorSession::selectedScaleX() const
{
    return m_selectedScaleX;
}

double EditorSession::selectedScaleY() const
{
    return m_selectedScaleY;
}

double EditorSession::selectedRotationDeg() const
{
    return m_selectedRotationDeg;
}

double EditorSession::selectedY() const
{
    return m_selectedY;
}

bool EditorSession::hasSelection() const
{
    return m_coordinator->selectedEntityId() != 0;
}

QString EditorSession::selectedObjectTypeId() const
{
    return m_selectedObjectTypeId;
}

QString EditorSession::selectedObjectTypeName() const
{
    return m_selectedObjectTypeName;
}

int EditorSession::logicRuleCount() const
{
    return m_logicRuleCount;
}

QVariantList EditorSession::logicRules() const
{
    return m_logicRules;
}

QVariantList EditorSession::logicSections() const
{
    return m_logicSections;
}

QString EditorSession::selectedLogicRuleId() const
{
    return m_selectedLogicRuleId;
}

QStringList EditorSession::logicTriggerCatalog() const
{
    QStringList ids;
    for (const ArtCade::Logic::LogicBlockDescriptor &desc : ArtCade::Logic::registry()) {
        if (desc.kind == ArtCade::Logic::BlockKind::Trigger) {
            ids.append(QString::fromStdString(desc.typeId));
        }
    }
    return ids;
}

QStringList EditorSession::logicConditionCatalog() const
{
    QStringList ids;
    for (const ArtCade::Logic::LogicBlockDescriptor &desc : ArtCade::Logic::registry()) {
        if (desc.kind == ArtCade::Logic::BlockKind::Condition) {
            ids.append(QString::fromStdString(desc.typeId));
        }
    }
    return ids;
}

QStringList EditorSession::logicActionCatalog() const
{
    QStringList ids;
    for (const ArtCade::Logic::LogicBlockDescriptor &desc : ArtCade::Logic::registry()) {
        if (desc.kind == ArtCade::Logic::BlockKind::Action) {
            ids.append(QString::fromStdString(desc.typeId));
        }
    }
    return ids;
}

QString EditorSession::logicBlockDisplayName(const QString &blockTypeId) const
{
    const ArtCade::Logic::LogicBlockDescriptor *desc =
        ArtCade::Logic::findDescriptor(blockTypeId.toStdString());
    if (!desc) {
        return blockTypeId;
    }
    return QString::fromStdString(desc->displayName);
}

QString EditorSession::logicBlockDescription(const QString &blockTypeId) const
{
    if (blockTypeId.isEmpty()) {
        return {};
    }
    const ArtCade::Logic::LogicBlockDescriptor *desc =
        ArtCade::Logic::findDescriptor(blockTypeId.toStdString());
    if (!desc) {
        return {};
    }
    return QString::fromStdString(desc->description);
}

QString EditorSession::logicKeyFromQtKey(int qtKey) const
{
    using ArtCade::LogicKey;
    LogicKey mapped = LogicKey::Space;
    bool ok = true;
    if (qtKey >= Qt::Key_A && qtKey <= Qt::Key_Z) {
        mapped = static_cast<LogicKey>(static_cast<int>(LogicKey::A) + (qtKey - Qt::Key_A));
    } else if (qtKey >= Qt::Key_0 && qtKey <= Qt::Key_9) {
        mapped = static_cast<LogicKey>(static_cast<int>(LogicKey::Num0) + (qtKey - Qt::Key_0));
    } else {
        switch (qtKey) {
        case Qt::Key_Left:
            mapped = LogicKey::ArrowLeft;
            break;
        case Qt::Key_Right:
            mapped = LogicKey::ArrowRight;
            break;
        case Qt::Key_Up:
            mapped = LogicKey::ArrowUp;
            break;
        case Qt::Key_Down:
            mapped = LogicKey::ArrowDown;
            break;
        case Qt::Key_Space:
            mapped = LogicKey::Space;
            break;
        case Qt::Key_Return:
        case Qt::Key_Enter:
            mapped = LogicKey::Enter;
            break;
        default:
            ok = false;
            break;
        }
    }
    if (!ok) {
        return {};
    }
    const std::string name = ArtCade::Logic::logicKeyName(mapped);
    if (name.empty() || !ArtCade::Logic::logicKeyFromName(name)) {
        return {};
    }
    return QString::fromStdString(name);
}

void EditorSession::setSelectedLogicRuleId(const QString &ruleId)
{
    if (m_selectedLogicRuleId == ruleId) {
        return;
    }
    if (!ruleId.isEmpty() && !m_logicRuleIds.contains(ruleId)) {
        return;
    }
    m_selectedLogicRuleId = ruleId;
    emit selectedLogicRuleChanged();
}

QString EditorSession::activeLayerId() const
{
    return QString::fromStdString(m_coordinator->activeLayerId());
}

namespace {

const ArtCade::SceneDef *session_active_scene(const ArtCade::EditorCore::EditorCoordinator &coord)
{
    if (!coord.hasProject()) {
        return nullptr;
    }
    const ArtCade::ProjectDoc &doc = coord.document();
    auto it = doc.scenes.find(doc.activeSceneId);
    if (it != doc.scenes.end()) {
        return &it->second;
    }
    if (!doc.scenes.empty()) {
        return &doc.scenes.begin()->second;
    }
    return nullptr;
}

} // namespace

QString EditorSession::activeSceneName() const
{
    const ArtCade::SceneDef *scene = session_active_scene(*m_coordinator);
    if (!scene) {
        return {};
    }
    return QString::fromStdString(scene->name.empty() ? scene->id : scene->name);
}

double EditorSession::activeSceneWidth() const
{
    const ArtCade::SceneDef *scene = session_active_scene(*m_coordinator);
    return scene ? scene->worldSize.x : 0.0;
}

double EditorSession::activeSceneHeight() const
{
    const ArtCade::SceneDef *scene = session_active_scene(*m_coordinator);
    return scene ? scene->worldSize.y : 0.0;
}

double EditorSession::worldGravity() const
{
    if (!m_coordinator->hasProject()) {
        return 0.0;
    }
    return m_coordinator->document().world.gravity;
}

double EditorSession::worldPixelsPerMeter() const
{
    if (!m_coordinator->hasProject()) {
        return 0.0;
    }
    return m_coordinator->document().world.pixelsPerMeter;
}

void EditorSession::setActiveMode(const QString &mode)
{
    if (m_activeMode == mode) {
        return;
    }
    m_activeMode = mode;
    emit activeModeChanged();
}

QString EditorSession::activeTool() const
{
    return m_activeTool;
}

void EditorSession::setActiveTool(const QString &tool)
{
    QString normalized = tool;
    if (normalized != QLatin1String("select") && normalized != QLatin1String("pan")
        && normalized != QLatin1String("move") && normalized != QLatin1String("rect")) {
        normalized = QStringLiteral("select");
    }
    if (m_activeTool == normalized) {
        return;
    }
    m_activeTool = normalized;
    emit activeToolChanged();
}

bool EditorSession::snapEnabled() const
{
    return m_snap_enabled;
}

void EditorSession::setSnapEnabled(bool enabled)
{
    if (m_snap_enabled == enabled) {
        return;
    }
    m_snap_enabled = enabled;
    emit snapEnabledChanged();
}

QString EditorSession::selectedAssetId() const
{
    return m_selectedAssetId;
}

QString EditorSession::selectedAssetName() const
{
    return m_selectedAssetName;
}

QString EditorSession::selectedAssetKind() const
{
    return m_selectedAssetKind;
}

QString EditorSession::selectedAssetPath() const
{
    return m_selectedAssetPath;
}

bool EditorSession::hasAssetSelection() const
{
    return !m_selectedAssetId.isEmpty();
}

void EditorSession::setSelectedAssetId(const QString &assetId)
{
    if (assetId == m_selectedAssetId) {
        return;
    }
    if (assetId.isEmpty()) {
        clearAssetSelection();
        return;
    }
    QString display;
    QString kind;
    QString path;
    if (!m_assets || !m_assets->lookup(assetId, &display, &kind, &path)) {
        return;
    }
    // Workspace mutual exclusion with entity selection (Inspector priority).
    if (m_coordinator->selectedEntityId() != 0) {
        m_coordinator->clearSelection();
        refreshSelectionCache();
    }
    m_selectedAssetId = assetId;
    m_selectedAssetName = display;
    m_selectedAssetKind = kind;
    m_selectedAssetPath = path;
    emit selectedAssetChanged();
}

void EditorSession::clearAssetSelection()
{
    if (m_selectedAssetId.isEmpty() && m_selectedAssetName.isEmpty()
        && m_selectedAssetKind.isEmpty() && m_selectedAssetPath.isEmpty()) {
        return;
    }
    m_selectedAssetId.clear();
    m_selectedAssetName.clear();
    m_selectedAssetKind.clear();
    m_selectedAssetPath.clear();
    emit selectedAssetChanged();
}

void EditorSession::refreshAssetSelectionCache()
{
    if (m_selectedAssetId.isEmpty()) {
        return;
    }
    QString display;
    QString kind;
    QString path;
    if (!m_assets || !m_assets->lookup(m_selectedAssetId, &display, &kind, &path)) {
        clearAssetSelection();
        return;
    }
    if (display == m_selectedAssetName && kind == m_selectedAssetKind
        && path == m_selectedAssetPath) {
        return;
    }
    m_selectedAssetName = display;
    m_selectedAssetKind = kind;
    m_selectedAssetPath = path;
    emit selectedAssetChanged();
}

bool EditorSession::consoleCollapsed() const
{
    return m_consoleCollapsed;
}

void EditorSession::setConsoleCollapsed(bool collapsed)
{
    if (m_consoleCollapsed == collapsed) {
        return;
    }
    m_consoleCollapsed = collapsed;
    emit consoleCollapsedChanged();
}

double EditorSession::sceneGridStep() const
{
    return static_cast<double>(ArtCade::EditorCore::EditorCoordinator::kSceneViewPlaceholderExtent);
}

QString EditorSession::normalizePath(const QString &pathOrUrl) const
{
    const QUrl url(pathOrUrl);
    if (url.isLocalFile()) {
        return url.toLocalFile();
    }
    return pathOrUrl;
}

void EditorSession::setStatus(const QString &message, bool logToConsole)
{
    if (m_statusMessage != message) {
        m_statusMessage = message;
        emit statusMessageChanged();
    }
    if (logToConsole && m_console) {
        m_console->appendInfo(message);
    }
}

bool EditorSession::guardAuthoring(QString *errorOut) const
{
    if (m_playing || (m_play && m_play->isRunning())) {
        if (errorOut) {
            *errorOut = QStringLiteral("Stop Play before editing");
        }
        return false;
    }
    return true;
}

void EditorSession::emitProjectSignals()
{
    emit projectNameChanged();
    emit dirtyChanged();
    emit hasProjectChanged();
    emit activeLayerChanged();
    emit projectChanged();
}

void EditorSession::reloadDerivedModels()
{
    m_hierarchy->reload();
    m_layers->reload();
    m_assets->reload();
    refreshAssetSelectionCache();
    refreshProjectCounts();
}

void EditorSession::refreshProjectCounts()
{
    m_sceneCount = 0;
    m_activeSceneInstanceCount = 0;
    if (!m_coordinator->hasProject()) {
        return;
    }
    const ArtCade::ProjectDoc &doc = m_coordinator->document();
    m_sceneCount = static_cast<int>(doc.scenes.size());
    const auto sceneIt = doc.scenes.find(doc.activeSceneId);
    if (sceneIt != doc.scenes.end()) {
        m_activeSceneInstanceCount = static_cast<int>(sceneIt->second.instances.size());
    }
}

void EditorSession::rememberRecentProject(const QString &path, const QString &name)
{
    if (path.isEmpty()) {
        return;
    }
    QVariantList next;
    QVariantMap head;
    head.insert(QStringLiteral("path"), path);
    head.insert(QStringLiteral("name"),
                name.isEmpty() ? QFileInfo(path).completeBaseName() : name);
    next.append(head);
    for (const QVariant &entry : m_recentProjects) {
        const QVariantMap map = entry.toMap();
        if (map.value(QStringLiteral("path")).toString() == path) {
            continue;
        }
        next.append(map);
        if (next.size() >= 8) {
            break;
        }
    }
    if (next == m_recentProjects) {
        return;
    }
    m_recentProjects = next;
    QSettings settings;
    settings.setValue(QStringLiteral("recentProjects"), m_recentProjects);
    emit recentProjectsChanged();
}

void EditorSession::refreshSelectionCache()
{
    const QString previous_rule = m_selectedLogicRuleId;
    m_selectedName.clear();
    m_selectedX = 0.0;
    m_selectedY = 0.0;
    m_selectedScaleX = 1.0;
    m_selectedScaleY = 1.0;
    m_selectedRotationDeg = 0.0;
    m_selectedObjectTypeId.clear();
    m_selectedObjectTypeName.clear();
    m_logicRuleCount = 0;
    m_logicRuleIds.clear();
    m_logicRules.clear();
    m_logicSections.clear();
    m_selectedLogicRuleId.clear();
    const auto id = m_coordinator->selectedEntityId();
    if (id != 0) {
        const ArtCade::ProjectDoc &doc = m_coordinator->document();
        if (const auto *inst = ArtCade::EditorCore::project_doc_find_instance(doc, id)) {
            m_selectedName = QString::fromStdString(inst->instanceName);
            m_selectedX = inst->transform.position.x;
            m_selectedY = inst->transform.position.y;
            m_selectedScaleX = inst->transform.scale.x;
            m_selectedScaleY = inst->transform.scale.y;
            m_selectedRotationDeg =
                static_cast<double>(inst->transform.rotation) * (180.0 / 3.14159265358979323846);
            m_selectedObjectTypeId = QString::fromStdString(inst->objectTypeId);
            if (!inst->objectTypeId.empty()) {
                const auto typeIt = doc.objectTypes.find(inst->objectTypeId);
                if (typeIt != doc.objectTypes.end()) {
                    const ArtCade::EntityDef &type = typeIt->second;
                    const std::string &label =
                        type.name.empty() ? inst->objectTypeId : type.name;
                    m_selectedObjectTypeName = QString::fromStdString(label);
                    if (type.logicBoard) {
                        for (const ArtCade::LogicSectionDef &section :
                             type.logicBoard->sections) {
                            m_logicSections.append(QVariantMap{
                                {QStringLiteral("id"), QString::fromStdString(section.id)},
                                {QStringLiteral("name"), QString::fromStdString(section.name)},
                            });
                        }
                        // Authoring-mode diagnostics: draft-friendly, same validator
                        // the Play gate uses in Executable mode.
                        const std::vector<ArtCade::Logic::LogicDiagnostic> board_diags =
                            ArtCade::Logic::validateBoard(
                                inst->objectTypeId, *type.logicBoard, &type, &doc,
                                ArtCade::Logic::ValidationMode::Authoring);
                        m_logicRuleCount = static_cast<int>(type.logicBoard->rules.size());
                        for (const ArtCade::LogicRuleDef &rule : type.logicBoard->rules) {
                            m_logicRuleIds.append(QString::fromStdString(rule.id));
                            QStringList condition_ids;
                            for (const ArtCade::LogicBlockDef &block : rule.conditions) {
                                condition_ids.append(QString::fromStdString(block.typeId));
                            }
                            QStringList action_ids;
                            for (const ArtCade::LogicBlockDef &block : rule.actions) {
                                action_ids.append(QString::fromStdString(block.typeId));
                            }
                            const QVariantList condition_props =
                                rule.conditions.empty()
                                    ? QVariantList{}
                                    : logic_property_rows(doc, rule.conditions.front());
                            const QVariantList action_props =
                                rule.actions.empty()
                                    ? QVariantList{}
                                    : logic_property_rows(doc, rule.actions.front());
                            int error_count = 0;
                            int warning_count = 0;
                            QVariantList rule_diags;
                            for (const ArtCade::Logic::LogicDiagnostic &diag : board_diags) {
                                if (diag.ruleId != rule.id) {
                                    continue;
                                }
                                const bool is_error = diag.severity
                                    == ArtCade::Logic::DiagnosticSeverity::Error;
                                if (is_error) {
                                    ++error_count;
                                } else {
                                    ++warning_count;
                                }
                                rule_diags.append(QVariantMap{
                                    {QStringLiteral("severity"),
                                     is_error ? QStringLiteral("error")
                                              : QStringLiteral("warning")},
                                    {QStringLiteral("message"),
                                     QString::fromStdString(diag.message)},
                                });
                            }
                            m_logicRules.append(QVariantMap{
                                {QStringLiteral("id"), QString::fromStdString(rule.id)},
                                {QStringLiteral("enabled"), rule.enabled},
                                {QStringLiteral("sectionId"),
                                 QString::fromStdString(rule.sectionId)},
                                {QStringLiteral("errorCount"), error_count},
                                {QStringLiteral("warningCount"), warning_count},
                                {QStringLiteral("diagnostics"), rule_diags},
                                {QStringLiteral("triggerTypeId"),
                                 QString::fromStdString(rule.trigger.typeId)},
                                {QStringLiteral("conditionTypeIds"), condition_ids},
                                {QStringLiteral("actionTypeIds"), action_ids},
                                {QStringLiteral("triggerProperties"),
                                 logic_property_rows(doc, rule.trigger)},
                                {QStringLiteral("conditionProperties"), condition_props},
                                {QStringLiteral("actionProperties"), action_props},
                            });
                        }
                    }
                } else {
                    m_selectedObjectTypeName = m_selectedObjectTypeId;
                }
            }
        }
    }
    if (!previous_rule.isEmpty() && m_logicRuleIds.contains(previous_rule)) {
        m_selectedLogicRuleId = previous_rule;
    } else if (!m_logicRuleIds.isEmpty()) {
        m_selectedLogicRuleId = m_logicRuleIds.first();
    }
    emit selectionChanged();
    emit selectedTransformChanged();
    emit logicRulesChanged();
    emit selectedLogicRuleChanged();
}

QString EditorSession::sliceFixturePath() const
{
    if (!developerMode()) {
        return {};
    }
    return QString::fromUtf8(ARTCADE_QT_SLICE_FIXTURE_PATH);
}

void EditorSession::openSliceFixture()
{
    if (!developerMode()) {
        setStatus(QStringLiteral("Fixture load is only available in developer builds"), false);
        return;
    }
    const QString path = sliceFixturePath();
    if (path.isEmpty() || !QFileInfo::exists(path)) {
        const QString msg =
            QStringLiteral("Slice fixture not found. Rebuild with ARTCADE_DEV_TOOLS and ARTCADE_QT_SLICE_FIXTURE_PATH.");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    openProject(path);
}

void EditorSession::clearRecentProjects()
{
    if (m_recentProjects.isEmpty()) {
        return;
    }
    m_recentProjects.clear();
    QSettings settings;
    settings.remove(QStringLiteral("recentProjects"));
    emit recentProjectsChanged();
}

bool EditorSession::requestClose()
{
    stopPlay();
    if (!m_coordinator->isDirty()) {
        emit closeAccepted();
        return true;
    }
    emit closeBlockedByDirty();
    return false;
}

void EditorSession::discardAndClose()
{
    if (m_coordinator->hasProject() && !m_coordinator->projectPath().empty()) {
        std::string error;
        const std::string path = m_coordinator->projectPath();
        if (m_coordinator->openProject(path, error)) {
            reloadDerivedModels();
            refreshSelectionCache();
            emitProjectSignals();
        }
    }
    emit closeAccepted();
}

void EditorSession::openProject(const QString &pathOrUrl)
{
    stopPlay();
    const QString path = normalizePath(pathOrUrl);
    std::string error;
    if (!m_coordinator->openProject(path.toStdString(), error)) {
        const QString msg = QString::fromStdString(error);
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    reloadDerivedModels();
    refreshSelectionCache();
    emitProjectSignals();
    rememberRecentProject(path, QString::fromStdString(m_coordinator->document().projectName));
    const QString name = QString::fromStdString(m_coordinator->document().projectName);
    if (developerMode()) {
        setStatus(QStringLiteral("Opened %1").arg(path));
    } else {
        setStatus(QStringLiteral("Opened “%1”").arg(name), false);
    }
}

void EditorSession::createProject(const QString &pathOrUrl, const QString &projectName)
{
    stopPlay();
    const QString path = normalizePath(pathOrUrl);
    QString name = projectName.trimmed();
    if (name.isEmpty()) {
        name = QFileInfo(path).completeBaseName();
    }
    if (name.isEmpty()) {
        name = QStringLiteral("Untitled");
    }
    std::string error;
    if (!m_coordinator->createNewProject(path.toStdString(), name.toStdString(), error)) {
        const QString msg = QString::fromStdString(error);
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    reloadDerivedModels();
    refreshSelectionCache();
    emitProjectSignals();
    rememberRecentProject(path, name);
    setStatus(QStringLiteral("Created “%1”").arg(name), false);
}

void EditorSession::undo()
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (!m_coordinator->canUndo()) {
        setStatus(QStringLiteral("Nothing to undo"));
        return;
    }
    m_coordinator->undo();
    reloadDerivedModels();
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Undo"));
}

void EditorSession::redo()
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (!m_coordinator->canRedo()) {
        setStatus(QStringLiteral("Nothing to redo"));
        return;
    }
    m_coordinator->redo();
    reloadDerivedModels();
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Redo"));
}

void EditorSession::saveProject()
{
    std::string error;
    if (!m_coordinator->saveProject(error)) {
        const QString msg = QString::fromStdString(error);
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    emit dirtyChanged();
    setStatus(QStringLiteral("Saved"));
}

void EditorSession::selectEntity(quint32 entityId)
{
    if (entityId != 0) {
        clearAssetSelection();
    }
    m_coordinator->selectEntity(entityId);
    refreshSelectionCache();
}

void EditorSession::clearSelection()
{
    m_coordinator->clearSelection();
    refreshSelectionCache();
}

void EditorSession::commitRename(const QString &newName)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (newName == m_selectedName) {
        return;
    }
    std::string error;
    if (!m_coordinator->renameSelected(newName.toStdString(), error)) {
        setStatus(QString::fromStdString(error));
        return;
    }
    m_hierarchy->reload();
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Renamed"));
}

void EditorSession::commitPosition(quint32 entityId, double x, double y)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (entityId == 0 || entityId != selectedEntityId()) {
        refreshSelectionCache();
        return;
    }
    std::string error;
    if (!m_coordinator->setEntityPosition(entityId, static_cast<float>(x), static_cast<float>(y),
                                          error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Position updated"));
}

void EditorSession::commitScale(quint32 entityId, double scaleX, double scaleY)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (entityId == 0 || entityId != selectedEntityId()) {
        refreshSelectionCache();
        return;
    }
    ArtCade::SceneId scene_id;
    const ArtCade::SceneInstanceDef *inst = nullptr;
    if (!ArtCade::EditorCore::project_doc_locate_instance(m_coordinator->document(),
                                                          entityId,
                                                          scene_id,
                                                          inst)
        || !inst) {
        const QString msg = QStringLiteral("Entity not found");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->setEntityScale(scene_id,
                                       entityId,
                                       static_cast<float>(scaleX),
                                       static_cast<float>(scaleY),
                                       error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        refreshSelectionCache();
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Scale updated"));
}

void EditorSession::commitRotation(quint32 entityId, double degrees)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (entityId == 0 || entityId != selectedEntityId()) {
        refreshSelectionCache();
        return;
    }
    ArtCade::SceneId scene_id;
    const ArtCade::SceneInstanceDef *inst = nullptr;
    if (!ArtCade::EditorCore::project_doc_locate_instance(m_coordinator->document(),
                                                          entityId,
                                                          scene_id,
                                                          inst)
        || !inst) {
        const QString msg = QStringLiteral("Entity not found");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    const float radians =
        static_cast<float>(degrees * (3.14159265358979323846 / 180.0));
    std::string error;
    if (!m_coordinator->setEntityRotation(scene_id, entityId, radians, error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        refreshSelectionCache();
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Rotation updated"));
}

void EditorSession::setActiveLayer(const QString &layerId)
{
    const std::string id = layerId.toStdString();
    if (m_coordinator->activeLayerId() == id) {
        return;
    }
    m_coordinator->setActiveLayerId(id);
    m_layers->reload();
    emit activeLayerChanged();
    setStatus(QStringLiteral("Active layer: %1").arg(layerId));
}

void EditorSession::setLayerVisible(const QString &layerId, bool visible)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    std::string error;
    if (!m_coordinator->setLayerVisible(layerId.toStdString(), visible, error)) {
        setStatus(QString::fromStdString(error));
        return;
    }
    m_layers->reload();
    emit dirtyChanged();
    setStatus(visible ? QStringLiteral("Layer shown") : QStringLiteral("Layer hidden"));
}

void EditorSession::addLogicRule()
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty()) {
        const QString msg = QStringLiteral("Select an object to add a Logic rule to its type");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    ArtCade::LogicRuleId new_rule_id;
    if (!m_coordinator->addLogicRule(m_selectedObjectTypeId.toStdString(), new_rule_id, error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    m_selectedLogicRuleId = QString::fromStdString(new_rule_id);
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Added Logic rule %1").arg(QString::fromStdString(new_rule_id)));
}

void EditorSession::removeLogicRule(const QString &ruleId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty()) {
        const QString msg = QStringLiteral("Select an object to remove a Logic rule from its type");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    const QString target = ruleId;
    if (target.isEmpty()) {
        const QString msg = QStringLiteral("No Logic rule selected to delete");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->removeLogicRule(
            m_selectedObjectTypeId.toStdString(), target.toStdString(), error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    if (m_selectedLogicRuleId == target) {
        m_selectedLogicRuleId.clear();
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Deleted Logic rule %1").arg(target));
}

void EditorSession::setLogicRuleTrigger(const QString &blockTypeId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || m_selectedLogicRuleId.isEmpty()) {
        const QString msg = QStringLiteral("Select a Logic rule to edit its When trigger");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->setLogicRuleTrigger(m_selectedObjectTypeId.toStdString(),
                                            m_selectedLogicRuleId.toStdString(),
                                            blockTypeId.toStdString(),
                                            error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("When: %1").arg(logicBlockDisplayName(blockTypeId)));
}

void EditorSession::setLogicRulePrimaryAction(const QString &blockTypeId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || m_selectedLogicRuleId.isEmpty()) {
        const QString msg = QStringLiteral("Select a Logic rule to edit its Then action");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->setLogicRulePrimaryAction(m_selectedObjectTypeId.toStdString(),
                                                  m_selectedLogicRuleId.toStdString(),
                                                  blockTypeId.toStdString(),
                                                  error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Then: %1").arg(logicBlockDisplayName(blockTypeId)));
}

void EditorSession::setLogicRulePrimaryCondition(const QString &blockTypeId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || m_selectedLogicRuleId.isEmpty()) {
        const QString msg = QStringLiteral("Select a Logic rule to edit Also require…");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (blockTypeId.isEmpty()) {
        if (!m_coordinator->clearLogicRuleConditions(m_selectedObjectTypeId.toStdString(),
                                                     m_selectedLogicRuleId.toStdString(),
                                                     error)) {
            setStatus(QString::fromStdString(error));
            emit errorOccurred(QString::fromStdString(error));
            return;
        }
        refreshSelectionCache();
        emit dirtyChanged();
        setStatus(QStringLiteral("Also require… cleared (always)"));
        return;
    }
    if (!m_coordinator->setLogicRulePrimaryCondition(m_selectedObjectTypeId.toStdString(),
                                                     m_selectedLogicRuleId.toStdString(),
                                                     blockTypeId.toStdString(),
                                                     error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Also require…: %1").arg(logicBlockDisplayName(blockTypeId)));
}

void EditorSession::setLogicRuleBlockProperty(const QString &ruleId,
                                              const QString &slot,
                                              const QString &propertyKey,
                                              const QString &valueText)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || ruleId.isEmpty() || propertyKey.isEmpty()) {
        const QString msg = QStringLiteral("Select a Logic rule to edit block properties");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    ArtCade::EditorCore::LogicRuleBlockSlot block_slot =
        ArtCade::EditorCore::LogicRuleBlockSlot::Trigger;
    if (slot == QLatin1String("condition")) {
        block_slot = ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryCondition;
    } else if (slot == QLatin1String("action")) {
        block_slot = ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction;
    } else if (slot != QLatin1String("trigger")) {
        const QString msg = QStringLiteral("Unknown Logic property slot");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    if (m_selectedLogicRuleId != ruleId) {
        setSelectedLogicRuleId(ruleId);
    }
    std::string error;
    if (!m_coordinator->setLogicRuleBlockProperty(m_selectedObjectTypeId.toStdString(),
                                                  ruleId.toStdString(),
                                                  block_slot,
                                                  propertyKey.toStdString(),
                                                  valueText.toStdString(),
                                                  error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("%1 = %2").arg(propertyKey, valueText));
}

void EditorSession::setLogicRuleEnabled(const QString &ruleId, bool enabled)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || ruleId.isEmpty()) {
        const QString msg = QStringLiteral("Select a Logic rule to enable or disable it");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->setLogicRuleEnabled(m_selectedObjectTypeId.toStdString(),
                                            ruleId.toStdString(),
                                            enabled,
                                            error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(enabled ? QStringLiteral("Enabled Logic rule %1").arg(ruleId)
                      : QStringLiteral("Disabled Logic rule %1").arg(ruleId));
}

void EditorSession::addLogicSection()
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty()) {
        const QString msg = QStringLiteral("Select an object to add a section to its board");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    std::string section_id;
    if (!m_coordinator->addLogicSection(
            m_selectedObjectTypeId.toStdString(), std::string{}, section_id, error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Added section %1").arg(QString::fromStdString(section_id)));
}

void EditorSession::renameLogicSection(const QString &sectionId, const QString &name)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || sectionId.isEmpty()) {
        const QString msg = QStringLiteral("Select a section to rename");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->renameLogicSection(m_selectedObjectTypeId.toStdString(),
                                           sectionId.toStdString(),
                                           name.toStdString(),
                                           error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Renamed section to %1").arg(name.trimmed()));
}

void EditorSession::removeLogicSection(const QString &sectionId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || sectionId.isEmpty()) {
        const QString msg = QStringLiteral("Select a section to remove");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->removeLogicSection(
            m_selectedObjectTypeId.toStdString(), sectionId.toStdString(), error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Removed section %1 (rules kept)").arg(sectionId));
}

void EditorSession::setLogicRuleSection(const QString &ruleId, const QString &sectionId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (m_selectedObjectTypeId.isEmpty() || ruleId.isEmpty()) {
        const QString msg = QStringLiteral("Select a Logic rule to move it into a section");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    std::string error;
    if (!m_coordinator->setLogicRuleSection(m_selectedObjectTypeId.toStdString(),
                                            ruleId.toStdString(),
                                            sectionId.toStdString(),
                                            error)) {
        setStatus(QString::fromStdString(error));
        emit errorOccurred(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(sectionId.isEmpty()
                  ? QStringLiteral("Rule %1 unsectioned").arg(ruleId)
                  : QStringLiteral("Rule %1 moved to section").arg(ruleId));
}

quint32 EditorSession::pickEntityAt(double worldX, double worldY)
{
    return m_coordinator->pickEntityAt(static_cast<float>(worldX), static_cast<float>(worldY));
}

void EditorSession::selectInWorldRect(double x0, double y0, double x1, double y1)
{
    const auto id = m_coordinator->pickEntityInRect(static_cast<float>(x0),
                                                    static_cast<float>(y0),
                                                    static_cast<float>(x1),
                                                    static_cast<float>(y1));
    if (id == 0) {
        clearSelection();
        return;
    }
    selectEntity(id);
}

void EditorSession::fitSceneView(SceneViewItem *view) const
{
    if (!view || !m_coordinator->hasProject()) {
        return;
    }
    const ArtCade::ProjectDoc &doc = m_coordinator->document();
    auto it = doc.scenes.find(doc.activeSceneId);
    if (it == doc.scenes.end()) {
        if (doc.scenes.empty()) {
            view->resetView();
            return;
        }
        it = doc.scenes.begin();
    }
    view->applyFit(it->second.worldSize.x, it->second.worldSize.y);
}

void EditorSession::paintSceneView(QPainter *painter, const SceneViewItem *view) const
{
    if (!painter || !view || !m_coordinator->hasProject()) {
        return;
    }

    const ArtCade::ProjectDoc &doc = m_coordinator->document();
    auto it = doc.scenes.find(doc.activeSceneId);
    if (it == doc.scenes.end()) {
        if (doc.scenes.empty()) {
            return;
        }
        it = doc.scenes.begin();
    }
    const ArtCade::SceneDef &scene = it->second;

    const qreal ruler = view->rulerSize();
    if (ruler > 0.0) {
        painter->fillRect(QRectF(0, 0, view->width(), ruler), QColor(0x13, 0x19, 0x22));
        painter->fillRect(QRectF(0, 0, ruler, view->height()), QColor(0x13, 0x19, 0x22));
        painter->fillRect(QRectF(0, 0, ruler, ruler), QColor(0x11, 0x16, 0x1e));
        painter->setPen(QPen(QColor(0x29, 0x32, 0x40), 1));
        painter->drawLine(QPointF(ruler, 0), QPointF(ruler, view->height()));
        painter->drawLine(QPointF(0, ruler), QPointF(view->width(), ruler));

        painter->setPen(QColor(0x68, 0x74, 0x86));
        painter->setFont(QFont(QStringLiteral("Consolas"), 8));
        const qreal world_left = view->screenToWorld(QPointF(ruler, ruler)).x();
        const qreal world_top = view->screenToWorld(QPointF(ruler, ruler)).y();
        const qreal world_right = view->screenToWorld(QPointF(view->width(), ruler)).x();
        const qreal world_bottom = view->screenToWorld(QPointF(ruler, view->height())).y();
        const qreal step = 32.0;
        const qreal start_x = std::floor(world_left / step) * step;
        for (qreal wx = start_x; wx <= world_right; wx += step) {
            const qreal sx = view->worldToScreen(QPointF(wx, 0)).x();
            if (sx < ruler) {
                continue;
            }
            painter->drawLine(QPointF(sx, ruler - 4), QPointF(sx, ruler));
            if (std::fmod(std::abs(wx), 128.0) < 0.01) {
                painter->drawText(QPointF(sx + 2, ruler - 6), QString::number(static_cast<int>(wx)));
            }
        }
        const qreal start_y = std::floor(world_top / step) * step;
        for (qreal wy = start_y; wy <= world_bottom; wy += step) {
            const qreal sy = view->worldToScreen(QPointF(0, wy)).y();
            if (sy < ruler) {
                continue;
            }
            painter->drawLine(QPointF(ruler - 4, sy), QPointF(ruler, sy));
            if (std::fmod(std::abs(wy), 128.0) < 0.01) {
                painter->drawText(QPointF(2, sy - 2), QString::number(static_cast<int>(wy)));
            }
        }
    }

    const QRectF world_rect(0.0, 0.0, scene.worldSize.x, scene.worldSize.y);
    const QPointF tl = view->worldToScreen(world_rect.topLeft());
    const QPointF br = view->worldToScreen(world_rect.bottomRight());
    const QRectF screen_world(tl, br);

    QColor bg(static_cast<int>(scene.backgroundColor.r * 255.f),
              static_cast<int>(scene.backgroundColor.g * 255.f),
              static_cast<int>(scene.backgroundColor.b * 255.f),
              255);
    painter->fillRect(screen_world, bg);
    painter->setPen(QPen(QColor(0x29, 0x2d, 0x35), 1));
    painter->drawRect(screen_world);

    if (view->gridVisible()) {
        painter->setPen(QPen(QColor(0x1e, 0x22, 0x29), 1));
        const float step = 32.f;
        for (float x = 0.f; x <= scene.worldSize.x + 0.01f; x += step) {
            const QPointF a = view->worldToScreen(QPointF(x, 0.0));
            const QPointF b = view->worldToScreen(QPointF(x, scene.worldSize.y));
            painter->drawLine(a, b);
        }
        for (float y = 0.f; y <= scene.worldSize.y + 0.01f; y += step) {
            const QPointF a = view->worldToScreen(QPointF(0.0, y));
            const QPointF b = view->worldToScreen(QPointF(scene.worldSize.x, y));
            painter->drawLine(a, b);
        }
    }

    const quint32 selected = m_coordinator->selectedEntityId();
    const float extent = ArtCade::EditorCore::EditorCoordinator::kSceneViewPlaceholderExtent;
    // Visual: scale then rotate about placeholder center. Pick stays AABB (no OBB).

    for (const ArtCade::SceneInstanceDef &inst : scene.instances) {
        if (!inst.visible) {
            continue;
        }
        if (!inst.layerId.empty() && !m_coordinator->layerVisible(inst.layerId)) {
            continue;
        }

        QPointF pos(inst.transform.position.x, inst.transform.position.y);
        if (view->hasDragPreview() && view->dragEntityId() == inst.id) {
            pos = view->dragPreviewWorld();
        }

        const qreal w = extent * inst.transform.scale.x * view->zoom();
        const qreal h = extent * inst.transform.scale.y * view->zoom();
        const QPointF screen = view->worldToScreen(pos);
        const qreal center_x = screen.x() + w * 0.5;
        const qreal center_y = screen.y() + h * 0.5;
        const qreal degrees =
            static_cast<qreal>(inst.transform.rotation) * (180.0 / 3.14159265358979323846);

        const bool is_selected = inst.id == selected;
        painter->save();
        painter->translate(center_x, center_y);
        painter->rotate(degrees);
        const QRectF box(-w * 0.5, -h * 0.5, w, h);
        painter->fillRect(box, instance_fill(inst.id, is_selected));
        painter->setPen(QPen(is_selected ? QColor(0x4f, 0x8e, 0xe8) : QColor(0xd9, 0xdd, 0xe5),
                             is_selected ? 2 : 1));
        painter->drawRect(box);

        const QString label = inst.instanceName.empty()
            ? QString::fromStdString(inst.objectTypeId)
            : QString::fromStdString(inst.instanceName);
        painter->setPen(QColor(0xd9, 0xdd, 0xe5));
        painter->drawText(box.adjusted(4, 2, -2, -2), Qt::AlignLeft | Qt::AlignTop, label);
        painter->restore();
    }
}

void EditorSession::startPlay()
{
    if (m_playing || m_play->isRunning()) {
        setStatus(QStringLiteral("Play is already running"));
        return;
    }
    if (!m_coordinator->hasProject()) {
        const QString msg = QStringLiteral("Open a project before Play");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    // Play reads on-disk files only — never a live ProjectDoc mutation path.
    if (m_coordinator->isDirty()) {
        const QString msg = QStringLiteral("Save the project before Play");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }

    // Same Executable compile gate as game.exe load (LogicRuntime host).
    std::string logic_error;
    if (!m_coordinator->validateLogicForPlay(logic_error)) {
        const QString msg = QStringLiteral("Logic Board: %1")
                                .arg(QString::fromStdString(logic_error));
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }

    const QString game_exe = resolveGameExecutable();
    if (game_exe.isEmpty()) {
        const QString msg = QStringLiteral(
            "game.exe not found. Build target `game`, or set ARTCADE_GAME_EXE.");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }

    const QString project_dir = projectDirectory();
    QString error;
    if (!m_play->start(game_exe, project_dir, error)) {
        setStatus(error, false);
        emit errorOccurred(error);
        return;
    }

    m_playing = true;
    emit playingChanged();
    setStatus(QStringLiteral("Play — %1").arg(QFileInfo(game_exe).fileName()));
}

void EditorSession::stopPlay()
{
    if (!m_playing && !m_play->isRunning()) {
        return;
    }
    m_play->stop();
    if (m_playing) {
        m_playing = false;
        emit playingChanged();
        setStatus(QStringLiteral("Play stopped"));
    }
}

void EditorSession::onPlayProcessStopped(int exit_code, const QString &status_message)
{
    Q_UNUSED(exit_code);
    if (m_playing) {
        m_playing = false;
        emit playingChanged();
    }
    setStatus(status_message);
}

QString EditorSession::projectDirectory() const
{
    if (!m_coordinator->hasProject()) {
        return {};
    }
    return QFileInfo(QString::fromStdString(m_coordinator->projectPath())).absolutePath();
}

QString EditorSession::resolveGameExecutable() const
{
    const QByteArray env = qgetenv("ARTCADE_GAME_EXE");
    if (!env.isEmpty()) {
        const QString from_env = QString::fromLocal8Bit(env);
        if (QFileInfo::exists(from_env)) {
            return QFileInfo(from_env).absoluteFilePath();
        }
    }

    const QDir app_dir(QCoreApplication::applicationDirPath());
    const QString sibling = app_dir.filePath(QStringLiteral("game.exe"));
    if (QFileInfo::exists(sibling)) {
        return QFileInfo(sibling).absoluteFilePath();
    }

    return {};
}
