import re
ORD={'first':1,'second':2,'third':3,'fourth':4,'fifth':5,'sixth':6,'seventh':7,'eighth':8,'ninth':9,'tenth':10,'eleventh':11,'twelfth':12}
FING={'thumb':'拇指','index finger':'食指','middle finger':'中指','ring finger':'無名指','little finger':'小指'}
TOE={'big toe':'大趾','second toe':'第二趾','third toe':'第三趾','fourth toe':'第四趾','little toe':'小趾'}
BONE={'clavicle':'鎖骨','scapula':'肩胛骨','humerus':'肱骨','radius':'橈骨','ulna':'尺骨','femur':'股骨','patella':'髕骨','tibia':'脛骨','fibula':'腓骨',
 'hip bone':'髖骨（無名骨）','sacrum':'薦椎','manubrium':'胸骨柄','body of sternum':'胸骨體','xiphoid process':'劍突','hyoid bone':'舌骨','mandible':'下頜骨',
 'maxilla':'上頜骨','nasal bone':'鼻骨','zygomatic bone':'顴骨','frontal bone':'額骨','parietal bone':'頂骨','occipital bone':'枕骨','temporal bone':'顳骨',
 'sphenoid bone':'蝶骨','ethmoid':'篩骨','scaphoid':'舟狀骨（腕）','lunate':'月狀骨','triquetral':'三角骨','pisiform':'豌豆骨','trapezium':'大多角骨',
 'trapezoid':'小多角骨','capitate':'頭狀骨','hamate':'鉤狀骨','talus':'距骨','calcaneus':'跟骨','cuboid bone':'骰骨','medial cuneiform bone':'內側楔狀骨',
 'intermediate cuneiform bone':'中間楔狀骨','lateral cuneiform bone':'外側楔狀骨','atlas':'寰椎（C1）','axis':'樞椎（C2）','costal cartilage':'肋軟骨'}
MUS={'adductor brevis':'內收短肌','adductor longus':'內收長肌','adductor magnus':'內收大肌','adductor minimus':'內收小肌','gracilis':'股薄肌','pectineus':'恥骨肌',
 'long head of biceps brachii':'肱二頭肌長頭','short head of biceps brachii':'肱二頭肌短頭','brachialis':'肱肌','brachioradialis':'肱橈肌',
 'gemellus inferior':'下孖肌','gemellus superior':'上孖肌','obturator externus':'閉孔外肌','obturator internus':'閉孔內肌','quadratus femoris':'股方肌',
 'acromial part of deltoid':'三角肌中束','clavicular part of deltoid':'三角肌前束','spinal part of deltoid':'三角肌後束','diaphragm':'橫膈',
 'iliocostalis cervicis':'頸髂肋肌','iliocostalis lumborum':'腰髂肋肌','iliocostalis thoracis':'胸髂肋肌','longissimus capitis':'頭最長肌','longissimus cervicis':'頸最長肌',
 'longissimus thoracis':'胸最長肌','spinalis cervicis':'頸棘肌','spinalis thoracis':'胸棘肌','external oblique':'腹外斜肌','internal oblique':'腹內斜肌',
 'abductor pollicis longus':'外展拇長肌','extensor carpi radialis brevis':'橈側伸腕短肌','extensor carpi radialis longus':'橈側伸腕長肌','extensor digiti minimi':'伸小指肌',
 'extensor digitorum':'伸指肌','extensor digitorum brevis':'伸趾短肌','extensor digitorum longus':'伸趾長肌','extensor indicis':'伸食指肌','extensor pollicis brevis':'伸拇短肌',
 'extensor pollicis longus':'伸拇長肌','humeral head of extensor carpi ulnaris':'尺側伸腕肌（肱頭）','ulnar head of extensor carpi ulnaris':'尺側伸腕肌（尺頭）',
 'humeral head of flexor carpi ulnaris':'尺側屈腕肌（肱頭）','humeroulnar head of flexor digitorum superficialis':'屈指淺肌（肱尺頭）','radial head of flexor digitorum superficialis':'屈指淺肌（橈頭）',
 'ulnar head of flexor carpi ulnaris':'尺側屈腕肌（尺頭）','flexor carpi radialis':'橈側屈腕肌','flexor digitorum profundus':'屈指深肌','flexor pollicis longus':'屈拇長肌','palmaris longus':'掌長肌',
 'lateral head of gastrocnemius':'腓腸肌外側頭','medial head of gastrocnemius':'腓腸肌內側頭','calcaneal tendon':'跟腱（阿基里斯腱）','plantaris':'蹠肌',
 'gluteus maximus':'臀大肌','gluteus medius':'臀中肌','gluteus minimus':'臀小肌','long head of biceps femoris':'股二頭肌長頭','short head of biceps femoris':'股二頭肌短頭',
 'semimembranosus':'半膜肌','semitendinosus':'半腱肌','iliacus':'髂肌','psoas major':'腰大肌','infraspinatus':'棘下肌','latissimus dorsi':'闊背肌','levator scapulae':'提肩胛肌',
 'deep part of masseter':'咬肌深層','superficial part of masseter':'咬肌淺層','multifidus':'多裂肌','abdominal part of pectoralis major':'胸大肌腹部',
 'clavicular part of pectoralis major':'胸大肌鎖骨部','sternocostal part of pectoralis major':'胸大肌胸肋部','pectoralis minor':'胸小肌','fibularis brevis':'腓骨短肌',
 'fibularis longus':'腓骨長肌','fibularis tertius':'第三腓骨肌','piriformis':'梨狀肌','abductor hallucis':'外展拇趾肌','flexor accessorius':'蹠方肌','flexor digitorum brevis':'屈趾短肌',
 'popliteus':'膕肌','humeral head of pronator teres':'旋前圓肌（肱頭）','ulnar head of pronator teres':'旋前圓肌（尺頭）','pronator quadratus':'旋前方肌','quadratus lumborum':'腰方肌',
 'rectus abdominis':'腹直肌','rectus femoris':'股直肌','rhomboid major':'大菱形肌','rhomboid minor':'小菱形肌','sartorius':'縫匠肌','scalenus anterior':'前斜角肌',
 'scalenus medius':'中斜角肌','scalenus posterior':'後斜角肌','sternocleidomastoid':'胸鎖乳突肌','serratus anterior':'前鋸肌','soleus':'比目魚肌','splenius capitis':'頭夾肌',
 'splenius cervicis':'頸夾肌','obliquus capitis inferior':'頭下斜肌','obliquus capitis superior':'頭上斜肌','rectus capitis posterior major':'頭後大直肌',
 'rectus capitis posterior minor':'頭後小直肌','subscapularis':'肩胛下肌','supinator':'旋後肌','supraspinatus':'棘上肌','temporalis':'顳肌','teres major':'大圓肌',
 'teres minor':'小圓肌','tibialis anterior':'脛前肌','tibialis posterior':'脛後肌','ascending part of trapezius':'下斜方肌','transverse part of trapezius':'中斜方肌',
 'descending part of trapezius':'上斜方肌','lateral head of triceps brachii':'肱三頭肌外側頭','long head of triceps brachii':'肱三頭肌長頭','medial head of triceps brachii':'肱三頭肌內側頭',
 'vastus intermedius':'股中間肌','vastus lateralis':'股外側肌','vastus medialis':'股內側肌','skin':'皮膚'}
def zh(name):
    n=name.strip(); low=n.lower(); side=''
    if re.search(r'\bleft\b',low): side='左'
    elif re.search(r'\bright\b',low): side='右'
    b=re.sub(r'\b(left|right)\b ?','',low).replace(' of foot','').strip()
    m=re.match(r'(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (cervical|thoracic|lumbar) vertebra',b)
    if m: k=ORD[m.group(1)]; t={'cervical':('頸椎','C'),'thoracic':('胸椎','T'),'lumbar':('腰椎','L')}[m.group(2)]; return f'第{k}{t[0]}（{t[1]}{k}）'
    m=re.match(r'intervertebral disk of (.*)',b)
    if m: inner=zh(m.group(1)); code=re.search(r'（(.*)）',inner); return (code.group(1) if code else inner)+' 下方椎間盤'
    m=re.match(r'(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (rib|costal cartilage|metacarpal bone|metatarsal bone)',b)
    if m: k=ORD[m.group(1)]; return side+f'第{k}'+{'rib':'肋骨','costal cartilage':'肋軟骨','metacarpal bone':'掌骨','metatarsal bone':'蹠骨'}[m.group(2)]
    m=re.match(r'(distal|middle|proximal) phalanx of (.*)',b)
    if m:
        seg={'distal':'遠節','middle':'中節','proximal':'近節'}[m.group(1)]; w=m.group(2)
        if w in FING: return side+FING[w]+seg+'指骨'
        if w in TOE: return side+TOE[w]+seg+'趾骨'
    if b.startswith('navicular bone'): return side+'舟狀骨（足）'
    if b in BONE: return side+BONE[b]
    if b in MUS: return side+MUS[b]
    return None
if __name__=='__main__':
    import json
    s=json.load(open('sel2.json')); miss=[p['name'] for p in s if zh(p['name']) is None]; print('missing',miss)
    for p in s[:400:25]: print(p['name'],'->',zh(p['name']))
